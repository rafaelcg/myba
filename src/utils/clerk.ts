export function getClerkAccountPortalUrl(publishableKey?: string): string | null {
  if (!publishableKey) return null

  try {
    const encodedDomainPart = publishableKey.split('_')[2]
    if (!encodedDomainPart) return null

    const frontendHost = atob(encodedDomainPart).replace(/\$/g, '')
    if (!frontendHost) return null

    if (frontendHost.endsWith('.clerk.accounts.dev')) {
      return `https://${frontendHost.replace('.clerk.accounts.dev', '.accounts.dev')}`
    }

    if (frontendHost.startsWith('clerk.')) {
      return `https://accounts.${frontendHost.slice('clerk.'.length)}`
    }

    return `https://${frontendHost}`
  } catch {
    return null
  }
}

export function getClerkFallbackAuthUrls(publishableKey?: string): { signIn: string; signUp: string } | null {
  const accountPortalBase = getClerkAccountPortalUrl(publishableKey)
  if (!accountPortalBase) return null

  const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/app` : '/app'
  const encodedRedirect = encodeURIComponent(redirectUrl)

  return {
    signIn: `${accountPortalBase}/sign-in?redirect_url=${encodedRedirect}`,
    signUp: `${accountPortalBase}/sign-up?redirect_url=${encodedRedirect}`,
  }
}
