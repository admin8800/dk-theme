import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, Link as LinkIcon, Plus, ReceiptText, Users, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { copyText } from '@/lib/clipboard'
import { transferCommissionToBalance } from '@/lib/api/services/account'
import { generateInviteCode, getInviteDetails, getInviteStat, withdrawCommission } from '@/lib/api/services/invite'
import { getApiErrorMessage } from '@/lib/api/errors'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { useAuth } from '@/features/auth/auth-store'
import type { InviteStat } from '@/lib/api/types'

type WithdrawalChannel = 'alipay' | 'usdt' | 'paypal'

const withdrawalChannels: Array<{ value: WithdrawalChannel; label: string }> = [
  { value: 'alipay', label: '支付宝' },
  { value: 'usdt', label: 'USDT' },
  { value: 'paypal', label: 'PayPal' },
]

function getInviteLink(code?: string) {
  if (!code || typeof window === 'undefined') return ''
  return `${window.location.origin}/register?code=${encodeURIComponent(code)}`
}

function getRecordTypeLabel(type?: string) {
  switch (type) {
    case 'withdraw':
      return '提现'
    case 'transfer':
      return '转余额'
    default:
      return '佣金'
  }
}

function isSuccessStatus(status: unknown) {
  return status === 'success' || status === 'done' || status === 1 || status === '1'
}

export function InvitePage() {
  const queryClient = useQueryClient()
  const { user, patchUser } = useAuth()
  const inviteQuery = useQuery({ queryKey: ['invite'], queryFn: getInviteStat })
  const inviteDetailsQuery = useQuery({ queryKey: ['invite-details'], queryFn: getInviteDetails })

  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [withdrawChannel, setWithdrawChannel] = useState<WithdrawalChannel>('alipay')
  const [withdrawAccount, setWithdrawAccount] = useState('')
  const [transferAmount, setTransferAmount] = useState('')

  const invite = inviteQuery.data
  const records = inviteDetailsQuery.data ?? []
  const primaryCode = invite?.codes.find((item) => item.status === 0)?.code ?? invite?.codes[0]?.code
  const primaryInviteLink = useMemo(() => getInviteLink(primaryCode), [primaryCode])
  const hasAvailableInviteCode = Boolean(invite?.codes.some((item) => item.status === 0))
  const commissionBalance = invite?.stat.commission_balance ?? 0
  const commissionPending = invite?.stat.commission_pending ?? 0

  const generateInviteMutation = useMutation({
    mutationFn: generateInviteCode,
    onSuccess: async () => {
      toast.success('邀请码已生成')
      await queryClient.invalidateQueries({ queryKey: ['invite'] })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '生成邀请码失败，请稍后重试'))
    },
  })

  const withdrawMutation = useMutation({
    mutationFn: withdrawCommission,
    onSuccess: () => {
      toast.success('提现申请已提交')
      setWithdrawChannel('alipay')
      setWithdrawAccount('')
      setWithdrawOpen(false)
      queryClient.setQueryData<InviteStat | undefined>(['invite'], (current) => current
        ? { ...current, stat: { ...current.stat, commission_balance: 0 } }
        : current)
      patchUser({ commission_balance: 0 })
      void queryClient.invalidateQueries({ queryKey: ['invite-details'], refetchType: 'inactive' })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '提现申请提交失败，请稍后重试'))
    },
  })

  const transferMutation = useMutation({
    mutationFn: transferCommissionToBalance,
    onSuccess: (_data, amount) => {
      toast.success('佣金已划转到账户余额')
      setTransferAmount('')
      setTransferOpen(false)
      const nextCommissionBalance = Math.max(0, commissionBalance - (amount ?? 0))
      const nextBalance = amount == null ? undefined : (user?.balance ?? 0) + amount
      queryClient.setQueryData<InviteStat | undefined>(['invite'], (current) => current
        ? { ...current, stat: { ...current.stat, commission_balance: nextCommissionBalance } }
        : current)
      patchUser({
        commission_balance: nextCommissionBalance,
        ...(nextBalance == null ? {} : { balance: nextBalance }),
      })
      void queryClient.invalidateQueries({ queryKey: ['invite-details'], refetchType: 'inactive' })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '佣金划转失败，请稍后重试'))
    },
  })

  async function copyInviteLink() {
    if (!primaryInviteLink) {
      toast.error('当前没有可复制的邀请码链接')
      return
    }

    try {
      await copyText(primaryInviteLink)
      toast.success('邀请链接已复制')
    } catch {
      toast.error('复制失败，请稍后重试')
    }
  }

  function handleWithdraw() {
    const account = withdrawAccount.trim()

    if (!account) {
      toast.error('请输入提现账号')
      return
    }

    if (commissionBalance <= 0) {
      toast.error('当前没有可提现返利')
      return
    }

    withdrawMutation.mutate({
      withdraw_method: withdrawChannel,
      withdraw_account: account,
    })
  }

  function handleTransfer() {
    const amount = Number(transferAmount)

    if (!amount || amount <= 0) {
      toast.error('请输入正确的划转金额')
      return
    }

    const amountInCents = Math.round(amount * 100)
    if (amountInCents > commissionBalance) {
      toast.error('划转金额不能超过当前可提现返利')
      return
    }

    transferMutation.mutate(amountInCents)
  }

  return (
    <div className='space-y-8'>
      <PageHeader
        badge='邀请返利'
        title='邀请返利'
        actions={
          <Button variant='outline' className='bg-white/90 dark:bg-transparent' onClick={copyInviteLink}>
            <LinkIcon className='size-4' />
            复制邀请链接
          </Button>
        }
      />

      <div className='px-4 lg:px-6'>
        <Card className='border-slate-200/90 bg-white/96 shadow-lg shadow-slate-200/60 dark:border-border/70 dark:bg-card dark:shadow-none'>
          <CardContent className='grid gap-6 p-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center'>
            <div className='space-y-4'>
              <Badge variant='outline' className='bg-white/90 dark:bg-transparent'>推广概览</Badge>
              <div className='space-y-2'>
                <div className='text-3xl font-semibold tracking-tight text-slate-900 dark:text-foreground'>邀请链接与返利概览</div>
              </div>
            </div>

            <div className='grid gap-3 sm:grid-cols-3'>
              <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-border/70 dark:bg-background/35'>
                <div className='flex items-center gap-2 text-sm text-slate-500 dark:text-muted-foreground'>
                  <Users className='size-4' />
                  已邀请用户
                </div>
                <div className='mt-3 text-2xl font-semibold text-slate-900 dark:text-foreground'>{invite?.stat.invite_count ?? 0}</div>
              </div>
              <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-border/70 dark:bg-background/35'>
                <div className='flex items-center gap-2 text-sm text-slate-500 dark:text-muted-foreground'>
                  <Gift className='size-4' />
                  可提现返利
                </div>
                <div className='mt-3 text-2xl font-semibold text-slate-900 dark:text-foreground'>{formatCurrency(commissionBalance)}</div>
              </div>
              <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-border/70 dark:bg-background/35'>
                <div className='flex items-center gap-2 text-sm text-slate-500 dark:text-muted-foreground'>
                  <LinkIcon className='size-4' />
                  待结算返利
                </div>
                <div className='mt-3 text-2xl font-semibold text-slate-900 dark:text-foreground'>{formatCurrency(commissionPending)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='px-4 lg:px-6'>
        <div className='grid gap-6 xl:grid-cols-[0.9fr_1.1fr]'>
          <div className='space-y-6'>
            <Card className='border-slate-200/90 bg-white/96 shadow-lg shadow-slate-200/60 dark:border-border/70 dark:bg-card dark:shadow-none'>
              <CardHeader>
                <CardTitle>邀请码管理</CardTitle>
                <CardDescription>创建和复制用户端邀请码</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='rounded-3xl border border-slate-200/80 bg-slate-50/90 p-5 dark:border-border/70 dark:bg-background/35'>
                  <div className='text-sm text-slate-500 dark:text-muted-foreground'>当前邀请码</div>
                  <div className='mt-2 break-all text-xl font-semibold tracking-wide text-slate-900 dark:text-foreground'>{primaryCode ?? '--'}</div>
                  <div className='mt-3 break-all text-sm text-slate-500 dark:text-muted-foreground'>
                    {primaryInviteLink || '当前暂无可分享的邀请链接'}
                  </div>
                </div>

                <div className='grid gap-3 sm:grid-cols-2'>
                  <Button className='w-full rounded-2xl' onClick={copyInviteLink}>
                    <LinkIcon className='size-4' />
                    复制链接
                  </Button>
                  <Button
                    variant='outline'
                    className='w-full rounded-2xl bg-white/90 dark:bg-transparent'
                    onClick={() => generateInviteMutation.mutate()}
                    disabled={generateInviteMutation.isPending || hasAvailableInviteCode}
                  >
                    <Plus className='size-4' />
                    {generateInviteMutation.isPending ? '生成中...' : hasAvailableInviteCode ? '已有可用邀请码' : '生成邀请码'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className='border-slate-200/90 bg-white/96 shadow-lg shadow-slate-200/60 dark:border-border/70 dark:bg-card dark:shadow-none'>
              <CardHeader>
                <CardTitle>佣金操作</CardTitle>
                <CardDescription>提现与余额划转</CardDescription>
              </CardHeader>
              <CardContent className='grid gap-3 sm:grid-cols-2'>
                <Button className='w-full rounded-2xl' onClick={() => setWithdrawOpen(true)}>
                  <Wallet className='size-4' />
                  推广佣金提现
                </Button>
                <Button variant='outline' className='w-full rounded-2xl bg-white/90 dark:bg-transparent' onClick={() => setTransferOpen(true)}>
                  <Gift className='size-4' />
                  划转到账户余额
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className='border-slate-200/90 bg-white/96 shadow-lg shadow-slate-200/60 dark:border-border/70 dark:bg-card dark:shadow-none'>
            <CardHeader>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <CardTitle>佣金记录</CardTitle>
                  <CardDescription>返利、提现与划转记录</CardDescription>
                </div>
                <Badge variant='outline' className='bg-white/90 dark:bg-transparent'>共 {records.length} 条记录</Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-foreground'>
                <ReceiptText className='size-4 text-primary' />
                记录明细
              </div>
              {inviteDetailsQuery.isLoading ? (
                <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 text-sm text-slate-500 dark:border-border/70 dark:bg-background/35 dark:text-muted-foreground'>加载中...</div>
              ) : records.length > 0 ? records.map((item) => (
                <div
                  key={String(item.id)}
                  className='flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-border/70 dark:bg-background/35 md:flex-row md:items-center md:justify-between'
                >
                  <div className='min-w-0 space-y-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <div className='break-words font-medium text-slate-900 dark:text-foreground'>{item.title}</div>
                      <Badge
                        variant='outline'
                        className={isSuccessStatus(item.status)
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'bg-white/90 dark:bg-transparent'}
                      >
                        {isSuccessStatus(item.status) ? '已完成' : '处理中'}
                      </Badge>
                      <Badge variant='outline' className='bg-white/90 dark:bg-transparent'>{getRecordTypeLabel(item.type)}</Badge>
                    </div>
                    <div className='text-sm text-slate-500 dark:text-muted-foreground'>记录时间：{formatDateTime(item.created_at)}</div>
                  </div>
                  <div className='text-lg font-semibold text-slate-900 dark:text-foreground'>{formatCurrency(item.amount)}</div>
                </div>
              )) : (
                <div className='rounded-3xl border border-dashed border-slate-200/80 bg-slate-50/70 p-8 text-center text-sm text-slate-500 dark:border-border/70 dark:bg-background/20 dark:text-muted-foreground'>暂无佣金记录。</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className='border-slate-200/90 bg-white/96 shadow-2xl shadow-slate-200/70 dark:border-border dark:bg-card dark:shadow-black/30'>
          <DialogHeader>
            <DialogTitle>推广佣金提现</DialogTitle>
            <DialogDescription>填写提现渠道与账号后提交申请。</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 text-sm text-slate-600 dark:border-border/70 dark:bg-background/35 dark:text-muted-foreground'>
              当前可提现返利：{formatCurrency(commissionBalance)}
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <div className='text-sm font-medium text-slate-900 dark:text-foreground'>提现渠道</div>
                <Select value={withdrawChannel} onValueChange={(value) => setWithdrawChannel(value as WithdrawalChannel)}>
                  <SelectTrigger className='bg-white/90 dark:bg-input/30'>
                    <SelectValue placeholder='请选择提现渠道' />
                  </SelectTrigger>
                  <SelectContent>
                    {withdrawalChannels.map((channel) => (
                      <SelectItem key={channel.value} value={channel.value}>{channel.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <div className='text-sm font-medium text-slate-900 dark:text-foreground'>提现账号</div>
                <Input
                  placeholder={withdrawChannel === 'usdt' ? '请输入 USDT 钱包地址' : '请输入收款账号'}
                  value={withdrawAccount}
                  onChange={(event) => setWithdrawAccount(event.target.value)}
                  className='bg-white/90 dark:bg-input/30'
                />
              </div>
            </div>
            <div className='flex flex-col gap-3 sm:flex-row'>
              <Button className='w-full sm:w-auto' onClick={handleWithdraw} disabled={withdrawMutation.isPending}>
                {withdrawMutation.isPending ? '提交中...' : '提交提现'}
              </Button>
              <Button variant='outline' className='w-full bg-white/90 sm:w-auto dark:bg-transparent' onClick={() => setWithdrawOpen(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className='border-slate-200/90 bg-white/96 shadow-2xl shadow-slate-200/70 dark:border-border dark:bg-card dark:shadow-black/30'>
          <DialogHeader>
            <DialogTitle>划转佣金到账户余额</DialogTitle>
            <DialogDescription>输入金额后将返利划转到账户余额。</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 text-sm text-slate-600 dark:border-border/70 dark:bg-background/35 dark:text-muted-foreground'>
              当前可划转返利：{formatCurrency(commissionBalance)}
            </div>
            <Input
              type='number'
              min='0'
              step='0.01'
              placeholder='请输入划转金额'
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
              className='bg-white/90 dark:bg-input/30'
            />
            <div className='flex flex-col gap-3 sm:flex-row'>
              <Button className='w-full sm:w-auto' onClick={handleTransfer} disabled={transferMutation.isPending}>
                {transferMutation.isPending ? '划转中...' : '确认划转'}
              </Button>
              <Button variant='outline' className='w-full bg-white/90 sm:w-auto dark:bg-transparent' onClick={() => setTransferOpen(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
