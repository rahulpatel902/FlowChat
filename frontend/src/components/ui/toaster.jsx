import { useToast } from "./use-toast"
import * as React from "react"
import { cn } from "../../lib/utils"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast"

export function Toaster() {
  const { toasts } = useToast()
  const [isDark, setIsDark] = React.useState(() => {
    try {
      return localStorage.getItem('theme') === 'dark'
    } catch {
      return false
    }
  })

  // React to theme changes without refresh
  React.useEffect(() => {
    const onThemeChange = (e) => setIsDark(!!e?.detail?.isDark)
    const onStorage = (e) => {
      if (e.key === 'theme') setIsDark(e.newValue === 'dark')
    }
    window.addEventListener('theme-change', onThemeChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('theme-change', onThemeChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const darkVioletClass = isDark && props?.variant !== 'destructive'
          ? 'bg-violet-900 text-violet-50 border-violet-700/40'
          : ''
        return (
          <Toast key={id} {...props} className={cn(darkVioletClass)}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className={cn(isDark ? 'text-white/80 hover:text-white focus:ring-white/40' : '')} />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
