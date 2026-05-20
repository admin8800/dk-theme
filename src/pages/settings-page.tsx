import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, Gift, KeyRound, RefreshCcw, Send, ShieldCheck } from 'lucide-react'
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
  changePassword,
  resetSubscribeSecurity,
  updateReminderSettings,
} from '@/lib/api/services/settings'
import { getTelegramBotInfo } from '@/lib/api/services/account'
import { checkGiftCard, redeemGiftCard } from '@/lib/api/services/gift-card'
import { getApiErrorMessage } from '@/lib/api/errors'
import { getUserInfo } from '@/lib/api/services/user'
import type { UserInfo } from '@/lib/api/types'
import { useAuth } from '@/features/auth/auth-context'

type PasswordForm = {
  old_password: string
  new_password: string
  new_password_2: string
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const maybeResponse = 'response' in error ? (error as { response?: { data?: { message?: unknown } } }).response : undefined
    const responseMessage = maybeResponse?.data?.message
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage

    const directMessage = 'message' in error ? (error as { message?: unknown }).message : undefined
    if (typeof directMessage === 'string' && directMessage.trim()) return directMessage
  }

  return fallback
}

function SettingCardHeader({
  icon,
  badge,
  title,
  description,
  danger = false,
}: {
  icon: React.ReactNode
  badge: string
  title: string
  description: string
  danger?: boolean
}) {
  return (
    <CardHeader className='pb-4'>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
        <div className={`flex size-11 items-center justify-center rounded-2xl ${danger ? 'bg-rose-500/10 text-rose-500' : 'bg-primary/12 text-primary'}`}>
          {icon}
        </div>
        <Badge
          variant='outline'
          className={danger
            ? 'rounded-full border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
            : 'rounded-full border-slate-200/80 bg-white/80 dark:border-border/70 dark:bg-background/35'}
        >
          {badge}
        </Badge>
      </div>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  )
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { refresh } = useAuth()
  const userQuery = useQuery({ queryKey: ['settings-user'], queryFn: getUserInfo })
  const telegramQuery = useQuery({
    queryKey: ['telegram-bot-info'],
    queryFn: getTelegramBotInfo,
    retry: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
  })

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    old_password: '',
    new_password: '',
    new_password_2: '',
  })
  const [remindExpire, setRemindExpire] = useState(true)
  const [remindTraffic, setRemindTraffic] = useState(true)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [giftCardCode, setGiftCardCode] = useState('')

  useEffect(() => {
    const user = userQuery.data
    if (!user) return
    setRemindExpire(user.remind_expire !== 0)
    setRemindTraffic(user.remind_traffic !== 0)
  }, [userQuery.data])

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast.success('密码修改成功')
      setPasswordForm({ old_password: '', new_password: '', new_password_2: '' })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, '密码修改失败，请稍后重试'))
    },
  })

  const reminderMutation = useMutation({
    mutationFn: updateReminderSettings,
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<UserInfo | undefined>(['settings-user'], (current) => current
        ? {
            ...current,
            remind_expire: variables.remind_expire,
            remind_traffic: variables.remind_traffic,
          }
        : current)
      toast.success('通知设置已保存')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, '通知设置保存失败，请稍后重试'))
      const user = queryClient.getQueryData<UserInfo>(['settings-user'])
      setRemindExpire(user?.remind_expire !== 0)
      setRemindTraffic(user?.remind_traffic !== 0)
    },
  })

  const resetSubscribeMutation = useMutation({
    mutationFn: resetSubscribeSecurity,
    onSuccess: async () => {
      toast.success('订阅信息已重置，请重新导入订阅')
      setResetDialogOpen(false)
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: ['settings-user'] }),
      ])
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, '重置订阅信息失败，请稍后重试'))
    },
  })

  const checkGiftCardMutation = useMutation({
    mutationFn: checkGiftCard,
    onSuccess: (result) => {
      if (!result.valid) {
        toast.error(result.message || '礼品卡不可用')
        return
      }
      toast.success(result.amount ? `礼品卡可用，面值 ${result.amount / 100} 元` : (result.message || '礼品卡可用'))
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '礼品卡校验失败，请稍后重试'))
    },
  })

  const redeemGiftCardMutation = useMutation({
    mutationFn: redeemGiftCard,
    onSuccess: async (result) => {
      toast.success(result.amount ? `礼品卡已兑换：${result.amount / 100} 元` : (result.message || '礼品卡已兑换'))
      setGiftCardCode('')
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: ['settings-user'] }),
      ])
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, '礼品卡兑换失败，请稍后重试'))
    },
  })

  function handlePasswordChange<K extends keyof PasswordForm>(key: K, value: PasswordForm[K]) {
    setPasswordForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmitPassword() {
    if (passwordForm.old_password.length < 8 || passwordForm.new_password.length < 8 || passwordForm.new_password_2.length < 8) {
      toast.error('密码不能小于 8 位')
      return
    }

    if (passwordForm.new_password !== passwordForm.new_password_2) {
      toast.error('两次输入的新密码不一致')
      return
    }

    passwordMutation.mutate(passwordForm)
  }

  function handleSaveReminderSettings() {
    reminderMutation.mutate({
      remind_expire: remindExpire ? 1 : 0,
      remind_traffic: remindTraffic ? 1 : 0,
    })
  }

  function handleCheckGiftCard() {
    const code = giftCardCode.trim()
    if (!code) {
      toast.error('请先输入礼品卡卡号')
      return
    }
    checkGiftCardMutation.mutate(code)
  }

  function handleRedeemGiftCard() {
    const code = giftCardCode.trim()
    if (!code) {
      toast.error('请先输入礼品卡卡号')
      return
    }
    redeemGiftCardMutation.mutate(code)
  }

  return (
    <div className='space-y-8'>
      <PageHeader
        badge='安全中心'
        title='安全中心'
      />

      <div className='px-4 lg:px-6'>
        <div className='grid gap-6 xl:grid-cols-2'>
          <Card className='flex h-full flex-col border-slate-200/90 bg-white/96 shadow-lg shadow-slate-200/60 dark:border-border/70 dark:bg-card dark:shadow-none'>
            <SettingCardHeader
              icon={<KeyRound className='size-5' />}
              badge='安全能力'
              title='修改密码'
              description='定期更新密码可以降低账号被他人使用的风险。'
            />
            <CardContent className='flex flex-1 flex-col space-y-4 pt-0'>
              <div className='space-y-2'>
                <div className='text-sm font-medium text-slate-900 dark:text-foreground'>旧密码</div>
                <Input
                  type='password'
                  value={passwordForm.old_password}
                  onChange={(event) => handlePasswordChange('old_password', event.target.value)}
                  placeholder='请输入旧密码'
                  className='rounded-2xl border-slate-200/80 bg-white/90 shadow-sm dark:border-border/70 dark:bg-input/30'
                />
              </div>
              <div className='space-y-2'>
                <div className='text-sm font-medium text-slate-900 dark:text-foreground'>新密码</div>
                <Input
                  type='password'
                  value={passwordForm.new_password}
                  onChange={(event) => handlePasswordChange('new_password', event.target.value)}
                  placeholder='请输入新密码'
                  className='rounded-2xl border-slate-200/80 bg-white/90 shadow-sm dark:border-border/70 dark:bg-input/30'
                />
              </div>
              <div className='space-y-2'>
                <div className='text-sm font-medium text-slate-900 dark:text-foreground'>重复新密码</div>
                <Input
                  type='password'
                  value={passwordForm.new_password_2}
                  onChange={(event) => handlePasswordChange('new_password_2', event.target.value)}
                  placeholder='请重复新密码'
                  className='rounded-2xl border-slate-200/80 bg-white/90 shadow-sm dark:border-border/70 dark:bg-input/30'
                />
              </div>
              <div className='mt-auto flex flex-col gap-3 pt-2 sm:flex-row'>
                <Button className='w-full rounded-full sm:w-auto' onClick={handleSubmitPassword} disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? '修改中...' : '修改密码'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className='flex h-full flex-col border-slate-200/90 bg-white/96 shadow-lg shadow-slate-200/60 dark:border-border/70 dark:bg-card dark:shadow-none'>
            <SettingCardHeader
              icon={<BellRing className='size-5' />}
              badge='通知开关'
              title='邮件提醒'
              description='支持到期邮件提醒与流量邮件提醒，默认均为开启。'
            />
            <CardContent className='flex flex-1 flex-col space-y-4 pt-0'>
              <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-border/70 dark:bg-background/35'>
                <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <div className='font-medium text-slate-900 dark:text-foreground'>到期邮件提醒</div>
                    <div className='mt-1 text-sm text-slate-500 dark:text-muted-foreground'>套餐即将到期时通过邮件提醒你续费。</div>
                  </div>
                  <Button
                    variant={remindExpire ? 'default' : 'outline'}
                    className={remindExpire ? 'w-full rounded-full sm:min-w-20 sm:w-auto' : 'w-full rounded-full bg-white/90 sm:min-w-20 sm:w-auto dark:bg-transparent'}
                    onClick={() => setRemindExpire((value) => !value)}
                  >
                    {remindExpire ? '已开启' : '已关闭'}
                  </Button>
                </div>
              </div>
              <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-border/70 dark:bg-background/35'>
                <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <div className='font-medium text-slate-900 dark:text-foreground'>流量邮件提醒</div>
                    <div className='mt-1 text-sm text-slate-500 dark:text-muted-foreground'>流量使用达到提醒条件时发送邮件通知。</div>
                  </div>
                  <Button
                    variant={remindTraffic ? 'default' : 'outline'}
                    className={remindTraffic ? 'w-full rounded-full sm:min-w-20 sm:w-auto' : 'w-full rounded-full bg-white/90 sm:min-w-20 sm:w-auto dark:bg-transparent'}
                    onClick={() => setRemindTraffic((value) => !value)}
                  >
                    {remindTraffic ? '已开启' : '已关闭'}
                  </Button>
                </div>
              </div>
              <div className='mt-auto flex flex-col gap-3 pt-2 sm:flex-row'>
                <Button className='w-full rounded-full sm:w-auto' onClick={handleSaveReminderSettings} disabled={reminderMutation.isPending || userQuery.isLoading}>
                  {reminderMutation.isPending ? '保存中...' : '保存通知设置'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className='flex h-full flex-col border-slate-200/90 bg-white/96 shadow-lg shadow-slate-200/60 dark:border-border/70 dark:bg-card dark:shadow-none'>
            <SettingCardHeader
              icon={<ShieldCheck className='size-5' />}
              badge='账户概览'
              title='当前设置状态'
              description='展示当前邮箱与提醒开关状态，便于确认配置是否生效。'
            />
            <CardContent className='flex flex-1 flex-col space-y-4 pt-0'>
              <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-border/70 dark:bg-background/35'>
                <div className='text-sm text-slate-500 dark:text-muted-foreground'>账户邮箱</div>
                <div className='mt-2 break-all text-lg font-semibold text-slate-900 dark:text-foreground'>{userQuery.data?.email ?? '--'}</div>
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-border/70 dark:bg-background/35'>
                  <div className='text-sm text-slate-500 dark:text-muted-foreground'>到期提醒</div>
                  <div className='mt-2 text-lg font-semibold text-slate-900 dark:text-foreground'>{remindExpire ? '开启' : '关闭'}</div>
                </div>
                <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-border/70 dark:bg-background/35'>
                  <div className='text-sm text-slate-500 dark:text-muted-foreground'>流量提醒</div>
                  <div className='mt-2 text-lg font-semibold text-slate-900 dark:text-foreground'>{remindTraffic ? '开启' : '关闭'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className='flex h-full flex-col border-slate-200/90 bg-white/96 shadow-lg shadow-slate-200/60 dark:border-border/70 dark:bg-card dark:shadow-none'>
            <SettingCardHeader
              icon={<Gift className='size-5' />}
              badge='余额充值'
              title='礼品卡兑换'
              description='校验并兑换 Xboard 用户端礼品卡，成功后刷新账户余额。'
            />
            <CardContent className='flex flex-1 flex-col space-y-4 pt-0'>
              <Input
                value={giftCardCode}
                onChange={(event) => setGiftCardCode(event.target.value)}
                placeholder='请输入礼品卡卡号'
                className='rounded-2xl border-slate-200/80 bg-white/90 shadow-sm dark:border-border/70 dark:bg-input/30'
              />
              <div className='mt-auto flex flex-col gap-3 pt-2 sm:flex-row'>
                <Button variant='outline' className='w-full rounded-full bg-white/90 sm:w-auto dark:bg-transparent' onClick={handleCheckGiftCard} disabled={checkGiftCardMutation.isPending}>
                  {checkGiftCardMutation.isPending ? '校验中...' : '校验礼品卡'}
                </Button>
                <Button className='w-full rounded-full sm:w-auto' onClick={handleRedeemGiftCard} disabled={redeemGiftCardMutation.isPending}>
                  {redeemGiftCardMutation.isPending ? '兑换中...' : '兑换礼品卡'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className='flex h-full flex-col border-slate-200/90 bg-white/96 shadow-lg shadow-slate-200/60 dark:border-border/70 dark:bg-card dark:shadow-none'>
            <SettingCardHeader
              icon={<Send className='size-5' />}
              badge='消息通知'
              title='Telegram 绑定'
              description='绑定后可接收账号提醒与服务通知。'
            />
            <CardContent className='flex flex-1 flex-col space-y-4 pt-0'>
              {telegramQuery.data?.username || telegramQuery.data?.bind_url ? (
                <>
                  <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-border/70 dark:bg-background/35'>
                    <div className='text-sm text-slate-500 dark:text-muted-foreground'>Telegram Bot</div>
                    <div className='mt-2 break-all text-lg font-semibold text-slate-900 dark:text-foreground'>
                      {telegramQuery.data.username ? `@${telegramQuery.data.username.replace(/^@/, '')}` : '可绑定'}
                    </div>
                  </div>
                  {telegramQuery.data.bind_url ? (
                    <Button asChild className='mt-auto w-full rounded-full sm:w-auto'>
                      <a href={telegramQuery.data.bind_url} target='_blank' rel='noreferrer'>打开绑定入口</a>
                    </Button>
                  ) : null}
                </>
              ) : (
                <div className='rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 text-sm leading-6 text-slate-600 dark:border-border/70 dark:bg-background/35 dark:text-muted-foreground'>
                  Telegram 功能暂未开启。
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='flex h-full flex-col border-rose-200/80 bg-white/96 shadow-lg shadow-slate-200/60 dark:border-rose-500/30 dark:bg-card dark:shadow-none'>
            <SettingCardHeader
              icon={<RefreshCcw className='size-5' />}
              badge='高风险操作'
              title='重置订阅信息'
              description='如果订阅地址或 UUID 泄露，可重置订阅安全信息；重置后需重新导入订阅。'
              danger
            />
            <CardContent className='flex flex-1 flex-col space-y-4 pt-0'>
              <div className='rounded-3xl border border-dashed border-rose-200 bg-rose-50/60 p-5 text-sm leading-6 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'>
                请仅在确认订阅信息泄露时使用。重置后旧订阅将失效，客户端需要重新导入新的订阅信息。
              </div>
              <div className='mt-auto flex flex-col gap-3 pt-2 sm:flex-row'>
                <Button className='w-full rounded-full sm:w-auto' variant='destructive' onClick={() => setResetDialogOpen(true)}>
                  重置订阅信息
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className='border-slate-200/90 bg-white/96 shadow-2xl shadow-slate-200/70 dark:border-border dark:bg-card dark:shadow-black/30'>
          <DialogHeader>
            <DialogTitle>确认重置订阅信息？</DialogTitle>
            <DialogDescription>重置后你的 UUID 与订阅地址会变更，旧订阅将失效，需要在所有客户端重新导入。</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm leading-6 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'>
              如果你不确定订阅是否泄露，请不要执行该操作。续费、连不上、客户端异常等场景通常不需要重置订阅信息。
            </div>
            <div className='flex flex-col gap-3 sm:flex-row'>
              <Button className='w-full rounded-full sm:w-auto' variant='destructive' onClick={() => resetSubscribeMutation.mutate()} disabled={resetSubscribeMutation.isPending}>
                {resetSubscribeMutation.isPending ? '重置中...' : '确认重置'}
              </Button>
              <Button variant='outline' className='w-full rounded-full bg-white/90 sm:w-auto dark:bg-transparent' onClick={() => setResetDialogOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
