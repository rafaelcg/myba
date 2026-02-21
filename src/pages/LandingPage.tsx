import { useEffect, useMemo, useState } from 'react'
import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { SeoHead } from '../components/SeoHead'
import { getClerkFallbackAuthUrls } from '../utils/clerk'

type Priority = 'HIGH' | 'LOW'

type Ticket = {
  priority: Priority
  version: string
  title: string
  owner: string
  avatar: string
}

const boardColumns: Array<{ name: string; count: number; tickets: Ticket[] }> = [
  {
    name: 'Backlog',
    count: 3,
    tickets: [
      {
        priority: 'HIGH',
        version: 'v2.2',
        title: 'Add dark mode toggle for dashboard analytics',
        owner: '🦊 #4',
        avatar: 'https://i.pravatar.cc/80?img=12'
      },
      {
        priority: 'HIGH',
        version: 'v2.1',
        title: 'Implement real-time collaboration cursors',
        owner: '🦊 #3',
        avatar: 'https://i.pravatar.cc/80?img=22'
      },
      {
        priority: 'LOW',
        version: 'v1.9',
        title: 'Export tickets to PDF with custom templates',
        owner: '🦊 #1',
        avatar: 'https://i.pravatar.cc/80?img=31'
      }
    ]
  },
  {
    name: 'In Progress',
    count: 2,
    tickets: [
      {
        priority: 'HIGH',
        version: 'v2.2',
        title: 'Implement initial test case for product validation',
        owner: '🦊 #4',
        avatar: 'https://i.pravatar.cc/80?img=41'
      },
      {
        priority: 'LOW',
        version: 'v2.3',
        title: 'Integrate new payment gateway endpoints in checkout flow',
        owner: '🦊 #2',
        avatar: 'https://i.pravatar.cc/80?img=52'
      }
    ]
  },
  {
    name: 'Review',
    count: 2,
    tickets: [
      {
        priority: 'HIGH',
        version: 'v2.0',
        title: 'Redesign onboarding flow with progressive disclosure',
        owner: '🦊 #6',
        avatar: 'https://i.pravatar.cc/80?img=63'
      },
      {
        priority: 'LOW',
        version: 'v2.4',
        title: 'Add keyboard shortcuts for power users',
        owner: '🦊 #5',
        avatar: 'https://i.pravatar.cc/80?img=17'
      }
    ]
  },
  {
    name: 'Done',
    count: 3,
    tickets: [
      {
        priority: 'HIGH',
        version: 'v2.1',
        title: 'Integrate with GitLab Issues API for direct sprint sync',
        owner: '🦊 #7',
        avatar: 'https://i.pravatar.cc/80?img=27'
      },
      {
        priority: 'LOW',
        version: 'v1.8',
        title: 'Update documentation with new API endpoints',
        owner: '🦊 #2',
        avatar: 'https://i.pravatar.cc/80?img=37'
      },
      {
        priority: 'HIGH',
        version: 'v2.5',
        title: 'Fix mobile layout issues on iOS Safari',
        owner: '🦊 #8',
        avatar: 'https://i.pravatar.cc/80?img=47'
      }
    ]
  }
]

const faqItems = [
  {
    question: 'What does MyBA generate?',
    answer:
      'MyBA generates a structured user story, testable acceptance criteria, and story-point guidance from rough product input.'
  },
  {
    question: 'Who is MyBA for?',
    answer:
      'Founders, PMs, engineering managers, and developers who need clearer sprint-ready ticket drafts.'
  },
  {
    question: 'Which project tools does MyBA connect to today?',
    answer:
      'Right now MyBA connects to GitLab. Draft in MyBA, push to GitLab, and keep sprint execution in one flow.'
  }
]

const workflowSteps = [
  {
    title: 'Drop in raw product context',
    body: 'Paste the request exactly how it showed up: founder note, customer call snippet, or messy Slack thread.'
  },
  {
    title: 'Generate a ticket your team can run with',
    body: 'MyBA returns a clear story, testable acceptance criteria, and a practical estimate baseline in one go.'
  },
  {
    title: 'Align quickly and ship',
    body: 'Tighten the scope in minutes, then move into sprint planning with less debate and less ticket churn.'
  }
]

const pricingTiers = [
  {
    name: 'Free',
    subtitle: 'For solo builders and early startup teams',
    points: ['Spin up instantly', 'Generate sprint-ready drafts', 'Prove value before you commit']
  },
  {
    name: 'Team',
    subtitle: 'For teams shipping every sprint',
    points: ['Faster backlog refinement', 'Shared PM and engineering workflow', 'Less planning drag, more output']
  },
  {
    name: 'Scale',
    subtitle: 'For multi-squad product orgs',
    points: ['Consistent ticket quality across squads', 'Governance without slowing builders', 'Built for high-velocity roadmaps']
  }
]

const baseTitle = 'MyBA | AI Ticket Generator for Startup Product Teams'
const baseDescription =
  'MyBA turns rough product requests into sprint-ready tickets with user stories, acceptance criteria, and planning guidance for startup teams.'

export function LandingPage() {
  const { isSignedIn, isLoaded } = useUser()
  const fallbackAuthUrls = getClerkFallbackAuthUrls(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  const shouldUseFallbackAuth = import.meta.env.DEV && !isLoaded && Boolean(fallbackAuthUrls)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 }
    )

    document.querySelectorAll('.section-reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const jsonLd = useMemo(
    () => [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'MyBA',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: baseDescription,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        }
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer
          }
        }))
      }
    ],
    []
  )

  const renderPrimaryAction = (label: string) => {
    if (isSignedIn) {
      return (
        <Link to="/app" className="btn btn-primary" onMouseEnter={() => void import('./AppPage')}>
          Open App
        </Link>
      )
    }

    if (shouldUseFallbackAuth) {
      return (
        <a href={fallbackAuthUrls!.signUp} className="btn btn-primary">
          {label}
        </a>
      )
    }

    return (
      <SignUpButton mode="modal">
        <button className="btn btn-primary" type="button">
          {label}
        </button>
      </SignUpButton>
    )
  }

  const renderSecondaryAction = () => {
    if (isSignedIn) return null

    if (shouldUseFallbackAuth) {
      return (
        <a href={fallbackAuthUrls!.signIn} className="btn btn-ghost">
          Sign In
        </a>
      )
    }

    return (
      <SignInButton mode="modal">
        <button className="btn btn-ghost" type="button">
          Sign In
        </button>
      </SignInButton>
    )
  }

  return (
    <>
      <SeoHead title={baseTitle} description={baseDescription} path="/" jsonLd={jsonLd} />

      <div className="landing-root">
        <style>{`
          :root {
            --coral: #3b82f6;
            --orange: #22d3ee;
            --pink: #ec4899;
            --purple: #8b5cf6;
            --gold: #ffd166;
            --glass-bg: rgba(255, 255, 255, 0.1);
            --glass-border: rgba(255, 255, 255, 0.22);
            --glass-hover: rgba(255, 255, 255, 0.15);
            --text-primary: #ffffff;
            --text-secondary: rgba(255, 255, 255, 0.86);
            --text-muted: rgba(255, 255, 255, 0.68);
            --radius-sm: 8px;
            --radius-md: 12px;
            --radius-lg: 20px;
            --radius-xl: 28px;
            --radius-full: 9999px;
          }

          * { box-sizing: border-box; }
          html { scroll-behavior: smooth; }

          .landing-root {
            min-height: 100vh;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background:
              radial-gradient(circle at 10% 10%, rgba(59, 130, 246, 0.25), transparent 36%),
              radial-gradient(circle at 88% 16%, rgba(236, 72, 153, 0.22), transparent 36%),
              radial-gradient(circle at 24% 86%, rgba(34, 211, 238, 0.16), transparent 38%),
              linear-gradient(145deg, #090e1f 0%, #1a1240 52%, #2a124a 100%);
            overflow-x: hidden;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          .landing-root h1,
          .landing-root h2,
          .landing-root h3 {
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
            line-height: 1.2;
            letter-spacing: -0.02em;
          }

          .container {
            width: 100%;
            max-width: 1280px;
            margin: 0 auto;
            padding: 0 24px;
          }

          .aurora-container {
            position: fixed;
            inset: 0;
            z-index: -1;
            overflow: hidden;
          }

          .aurora-blob {
            position: absolute;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.46;
            animation: aurora-float 20s ease-in-out infinite;
          }

          .aurora-blob:nth-child(1) { width: 800px; height: 800px; background: var(--coral); top: -20%; left: -10%; }
          .aurora-blob:nth-child(2) { width: 600px; height: 600px; background: var(--orange); top: 40%; right: -15%; animation-delay: -5s; animation-duration: 25s; }
          .aurora-blob:nth-child(3) { width: 700px; height: 700px; background: var(--pink); bottom: -10%; left: 30%; animation-delay: -10s; animation-duration: 22s; }
          .aurora-blob:nth-child(4) { width: 500px; height: 500px; background: var(--purple); top: 10%; right: 30%; animation-delay: -15s; animation-duration: 28s; }
          .aurora-blob:nth-child(5) { width: 400px; height: 400px; background: var(--gold); bottom: 30%; left: 10%; opacity: 0.28; animation-delay: -7s; animation-duration: 24s; }

          .noise-overlay {
            position: fixed;
            inset: 0;
            z-index: -1;
            opacity: 0.03;
            pointer-events: none;
            background-image: radial-gradient(#ffffff 1px, transparent 1px);
            background-size: 3px 3px;
          }

          .header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            padding: 16px 0;
            transition: all 0.3s ease;
          }

          .header.scrolled { padding: 12px 0; }

          .header-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 24px;
            border-radius: var(--radius-full);
            background: ${scrolled ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
            backdrop-filter: ${scrolled ? 'blur(30px)' : 'none'};
            border: ${scrolled ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent'};
            transition: all 0.3s ease;
          }

          .logo {
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
            font-size: 24px;
            color: var(--text-primary);
            text-decoration: none;
          }

          .logo-icon {
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, var(--gold) 0%, #ffa94d 100%);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #1a1a2e;
            font-size: 18px;
            font-weight: 700;
          }

          .nav {
            display: none;
            align-items: center;
            gap: 32px;
          }

          .nav-link {
            font-family: 'Outfit', sans-serif;
            font-weight: 500;
            font-size: 15px;
            color: var(--text-secondary);
            text-decoration: none;
            transition: color 0.2s ease;
          }

          .nav-link:hover { color: var(--text-primary); }

          .header-actions { display: flex; align-items: center; gap: 12px; }

          .btn {
            border: none;
            font-family: inherit;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--radius-full);
            padding: 11px 18px;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s ease;
          }

          .btn-ghost {
            color: #fff;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.18);
          }

          .btn-primary {
            color: #1a1a2e;
            background: linear-gradient(135deg, var(--gold) 0%, #ffb347 100%);
            box-shadow: 0 8px 24px rgba(255, 209, 102, 0.3);
          }

          .hero { padding-top: 140px; padding-bottom: 60px; position: relative; }
          .hero-content { text-align: center; max-width: 820px; margin: 0 auto; }
          .hero-badge { margin-bottom: 28px; display: inline-flex; }

          .badge {
            padding: 8px 16px;
            border-radius: var(--radius-full);
            border: 1px solid var(--glass-border);
            background: rgba(255, 255, 255, 0.08);
            color: var(--gold);
            font-size: 13px;
            font-weight: 500;
          }

          .hero-title {
            font-size: clamp(40px, 8vw, 64px);
            font-weight: 800;
            margin-bottom: 18px;
            background: linear-gradient(135deg, #fff 0%, var(--gold) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .hero-subtitle {
            font-size: clamp(16px, 2.5vw, 20px);
            color: rgba(255, 255, 255, 0.92);
            margin-bottom: 46px;
            max-width: 680px;
            margin-left: auto;
            margin-right: auto;
          }

          .hero-tags {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
          }

          .hero-tag {
            border: 1px solid var(--glass-border);
            background: rgba(255, 255, 255, 0.08);
            color: var(--text-secondary);
            border-radius: var(--radius-full);
            padding: 8px 14px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.02em;
          }

          .board-section { padding: 40px 0 80px; position: relative; }
          .board-frame {
            background: rgba(18, 17, 35, 0.62);
            backdrop-filter: blur(30px);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: var(--radius-xl);
            overflow: hidden;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
          }

          .board-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            background: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid var(--glass-border);
          }

          .board-title {
            font-family: 'Outfit', sans-serif;
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .board-title-icon {
            width: 28px;
            height: 28px;
            border-radius: 6px;
            background: linear-gradient(135deg, var(--coral), var(--orange));
            display: grid;
            place-items: center;
            font-size: 14px;
          }

          .board-actions {
            display: flex;
            gap: 8px;
            color: var(--text-secondary);
            font-size: 13px;
          }

          .kanban-board {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            padding: 24px;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, transparent 100%);
          }

          .kanban-column {
            background: rgba(255, 255, 255, 0.03);
            border-radius: var(--radius-md);
            padding: 16px;
            min-height: 400px;
          }

          .column-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--glass-border);
          }

          .column-title {
            font-family: 'Outfit', sans-serif;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
          }

          .column-count {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
            background: rgba(255, 255, 255, 0.1);
            padding: 2px 8px;
            border-radius: var(--radius-full);
          }

          .ticket-card {
            background: linear-gradient(165deg, rgba(62, 56, 83, 0.88) 0%, rgba(55, 45, 76, 0.9) 100%);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: var(--radius-lg);
            padding: 14px;
            margin-bottom: 12px;
          }

          .ticket-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          }

          .ticket-pill {
            font-family: 'Outfit', sans-serif;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.06em;
            padding: 5px 12px;
            border-radius: 15px;
            text-transform: uppercase;
            border: 1px solid transparent;
          }

          .priority-high {
            border-color: rgba(239, 68, 68, 0.6);
            color: #ff9f9f;
            background: rgba(239, 68, 68, 0.14);
          }

          .priority-low {
            border-color: rgba(34, 197, 94, 0.65);
            color: #8ef0b2;
            background: rgba(34, 197, 94, 0.16);
          }

          .version-pill {
            font-size: 11px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.72);
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.22);
            text-transform: none;
          }

          .ticket-title {
            font-size: 13px;
            font-weight: 500;
            color: var(--text-primary);
            line-height: 1.5;
            margin-bottom: 12px;
          }

          .ticket-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }

          .owner-pill {
            font-size: 11px;
            font-weight: 600;
            text-transform: none;
            color: #ffb366;
            background: rgba(217, 119, 6, 0.18);
            border-color: rgba(217, 119, 6, 0.48);
          }

          .ticket-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            object-fit: cover;
            border: 1px solid rgba(255, 255, 255, 0.35);
          }

          .add-ticket-btn {
            width: 100%;
            padding: 10px;
            background: transparent;
            border: 1px dashed var(--glass-border);
            border-radius: var(--radius-sm);
            color: var(--text-muted);
            font-size: 13px;
            font-family: inherit;
          }

          .features { padding: 84px 0; position: relative; }
          .section-header { text-align: center; max-width: 760px; margin: 0 auto 44px; }
          .section-title { font-size: clamp(32px, 5vw, 48px); margin-bottom: 16px; }
          .section-subtitle { font-size: 18px; color: var(--text-secondary); }

          .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
          }

          .feature-card {
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
            padding: 28px;
          }

          .feature-title { font-size: 24px; margin-bottom: 10px; }
          .feature-description { color: var(--text-secondary); }

          .workflow-grid {
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 24px;
            align-items: start;
          }

          .video-wrap {
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .workflow-video {
            width: 100%;
            display: block;
          }

          .steps-list {
            display: grid;
            gap: 12px;
            align-content: start;
          }

          .step-item {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            padding: 14px;
          }

          .step-kicker {
            display: inline-flex;
            align-items: center;
            border-radius: var(--radius-full);
            border: 1px solid rgba(255, 209, 102, 0.45);
            background: rgba(255, 209, 102, 0.12);
            color: #ffd98f;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            padding: 4px 10px;
            margin-bottom: 8px;
          }

          .step-title {
            font-family: 'Outfit', sans-serif;
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 4px;
          }

          .step-body {
            color: var(--text-secondary);
            font-size: 14px;
          }

          .pricing-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
          }

          .pricing-card {
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
            padding: 24px;
            display: grid;
            gap: 12px;
            align-content: start;
          }

          .pricing-card.highlight {
            background: rgba(255, 255, 255, 0.18);
            border-color: rgba(255, 209, 102, 0.5);
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24);
          }

          .pricing-badge {
            justify-self: start;
            border-radius: var(--radius-full);
            border: 1px solid rgba(255, 209, 102, 0.45);
            background: rgba(255, 209, 102, 0.16);
            color: #ffe3a9;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            padding: 4px 10px;
          }

          .pricing-name {
            font-family: 'Outfit', sans-serif;
            font-size: 24px;
          }

          .pricing-subtitle {
            color: var(--text-secondary);
            font-size: 14px;
            margin-bottom: 12px;
          }

          .pricing-points {
            margin: 0;
            padding-left: 18px;
            color: var(--text-secondary);
            display: grid;
            gap: 8px;
            font-size: 14px;
          }

          .pricing-cta {
            margin-top: 6px;
            justify-self: start;
            font-size: 13px;
            font-weight: 600;
            color: #ffd98f;
            text-decoration: none;
          }

          .cta { padding: 84px 0; }
          .cta-container {
            background: rgba(255, 255, 255, 0.15);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-xl);
            padding: 44px 36px;
            text-align: center;
          }

          .cta-title { font-size: clamp(28px, 4vw, 40px); margin-bottom: 12px; }
          .cta-subtitle { color: var(--text-secondary); margin-bottom: 28px; }

          .faq { padding: 64px 0 84px; }
          .faq-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
          }

          .footer {
            padding: 40px 0 54px;
            border-top: 1px solid var(--glass-border);
          }

          .footer-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
          }

          .footer-links { display: flex; gap: 14px; flex-wrap: wrap; }
          .footer-link { color: var(--text-secondary); text-decoration: none; }
          .footer-copy { color: var(--text-muted); }

          .section-reveal {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.55s ease, transform 0.55s ease;
          }

          .section-reveal.visible {
            opacity: 1;
            transform: translateY(0);
          }

          @keyframes aurora-float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(50px, -30px) scale(1.1); }
            50% { transform: translate(-30px, 50px) scale(0.95); }
            75% { transform: translate(40px, 20px) scale(1.05); }
          }

          @media (min-width: 940px) {
            .nav { display: flex; }
          }

          @media (max-width: 1020px) {
            .kanban-board { grid-template-columns: 1fr 1fr; }
            .features-grid, .faq-grid, .pricing-grid { grid-template-columns: 1fr 1fr; }
            .workflow-grid { grid-template-columns: 1fr; }
          }

          @media (max-width: 640px) {
            .container { padding: 0 14px; }
            .header-inner { padding: 10px 14px; }
            .hero { padding-top: 120px; }
            .kanban-board, .features-grid, .faq-grid, .pricing-grid { grid-template-columns: 1fr; }
          }
        `}</style>

        <div className="aurora-container">
          <div className="aurora-blob" />
          <div className="aurora-blob" />
          <div className="aurora-blob" />
          <div className="aurora-blob" />
          <div className="aurora-blob" />
        </div>
        <div className="noise-overlay" />

        <header className={`header ${scrolled ? 'scrolled' : ''}`} id="header">
          <div className="container">
            <div className="header-inner">
              <Link to="/" className="logo">
                <div className="logo-icon">✦</div>
                MyBA
              </Link>

              <nav className="nav">
                <a href="#features" className="nav-link">Features</a>
                <a href="#how-it-works" className="nav-link">How it Works</a>
                <a href="#pricing" className="nav-link">Pricing</a>
                <a href="#faq" className="nav-link">FAQ</a>
              </nav>

              <div className="header-actions">
                {renderSecondaryAction()}
                {renderPrimaryAction('Get Started Free')}
                {isSignedIn ? <UserButton afterSignOutUrl="/" /> : null}
              </div>
            </div>
          </div>
        </header>

        <main>
          <section className="hero">
            <div className="container">
              <div className="hero-content section-reveal visible">
                <div className="hero-badge">
                  <span className="badge">Built for startup product and engineering teams</span>
                </div>

                <h1 className="hero-title">Turn chaotic product requests into tickets your team can ship</h1>
                <p className="hero-subtitle">
                  MyBA converts rough context into structured stories, testable criteria, and execution-ready scope so your sprint starts clean and stays fast.
                </p>

                <div className="hero-tags">
                  <span className="hero-tag">No fake productivity theater</span>
                  <span className="hero-tag">Less ticket churn, more shipping</span>
                  <span className="hero-tag">Startup speed without process chaos</span>
                </div>
              </div>
            </div>
          </section>

          <section className="board-section">
            <div className="container">
              <div className="board-container section-reveal visible">
                <div className="board-frame">
                  <div className="board-header">
                    <div className="board-title">
                      <div className="board-title-icon">📋</div>
                      Your Board View
                    </div>
                    <div className="board-actions">Filter • Sort • + New Ticket</div>
                  </div>

                  <div className="kanban-board">
                    {boardColumns.map((column) => (
                      <div className="kanban-column" key={column.name}>
                        <div className="column-header">
                          <span className="column-title">{column.name}</span>
                          <span className="column-count">{column.count}</span>
                        </div>

                        {column.tickets.map((ticket, index) => (
                          <div className="ticket-card" key={`${column.name}-${index}`}>
                            <div className="ticket-head">
                              <span className={`ticket-pill ${ticket.priority === 'HIGH' ? 'priority-high' : 'priority-low'}`}>
                                {ticket.priority}
                              </span>
                              <span className="ticket-pill version-pill">{ticket.version}</span>
                            </div>
                            <div className="ticket-title">{ticket.title}</div>
                            <div className="ticket-meta">
                              <span className="ticket-pill owner-pill">{ticket.owner}</span>
                              <img className="ticket-avatar" src={ticket.avatar} alt="Assignee profile" loading="lazy" />
                            </div>
                          </div>
                        ))}

                        <button className="add-ticket-btn" type="button">+ Add Ticket</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="features" id="features">
            <div className="container">
              <div className="section-header section-reveal visible">
                <h2 className="section-title">From messy intake to build-ready tickets</h2>
                <p className="section-subtitle">Keep your current workflow and upgrade the quality of what enters your sprint board.</p>
              </div>

              <div className="features-grid">
                <div className="feature-card section-reveal visible">
                  <h3 className="feature-title">Story structure that engineers trust</h3>
                  <p className="feature-description">Generate tickets that clearly define the user, intent, scope, and expected behavior.</p>
                </div>
                <div className="feature-card section-reveal visible">
                  <h3 className="feature-title">Acceptance criteria you can actually test</h3>
                  <p className="feature-description">Give engineering and QA concrete conditions to validate without clarification loops.</p>
                </div>
                <div className="feature-card section-reveal visible">
                  <h3 className="feature-title">Planning guidance, not black-box guesses</h3>
                  <p className="feature-description">Use estimate suggestions as a practical baseline, then calibrate with your team’s cadence.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="features" id="how-it-works">
            <div className="container">
              <div className="section-header section-reveal visible">
                <h2 className="section-title">See the ticket generation flow in action</h2>
                <p className="section-subtitle">Exactly where the video belongs: next to the workflow your team follows every sprint.</p>
              </div>

              <div className="workflow-grid">
                <div className="video-wrap section-reveal visible">
                  <video
                    className="workflow-video"
                    src="/videos/ai-ticket-generation-showcase.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls
                    preload="metadata"
                  />
                </div>

                <div className="steps-list">
                  {workflowSteps.map((step) => (
                    <div className="step-item section-reveal visible" key={step.title}>
                      <span className="step-kicker">Workflow</span>
                      <h3 className="step-title">{step.title}</h3>
                      <p className="step-body">{step.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="features" id="pricing">
            <div className="container">
              <div className="section-header section-reveal visible">
                <h2 className="section-title">Pricing built for startup momentum</h2>
                <p className="section-subtitle">Start lean, align your team, and scale when your sprint velocity demands it.</p>
              </div>

              <div className="pricing-grid">
                {pricingTiers.map((tier) => (
                  <div
                    className={`pricing-card section-reveal visible ${tier.name === 'Team' ? 'highlight' : ''}`}
                    key={tier.name}
                  >
                    {tier.name === 'Team' ? <span className="pricing-badge">Most Popular</span> : null}
                    <h3 className="pricing-name">{tier.name}</h3>
                    <p className="pricing-subtitle">{tier.subtitle}</p>
                    <ul className="pricing-points">
                      {tier.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                    <a className="pricing-cta" href="#header">
                      Choose {tier.name}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="cta">
            <div className="container">
              <div className="cta-container section-reveal visible">
                <h2 className="cta-title">Your sprint board should move as fast as your roadmap</h2>
                <p className="cta-subtitle">Create your first AI-generated ticket draft and give your next planning session a cleaner starting point.</p>
                {renderPrimaryAction('Start Free')}
              </div>
            </div>
          </section>

          <section className="faq" id="faq">
            <div className="container">
              <div className="section-header section-reveal visible">
                <h2 className="section-title">FAQ</h2>
                <p className="section-subtitle">Quick answers for startup teams evaluating MyBA.</p>
              </div>

              <div className="faq-grid">
                {faqItems.map((item) => (
                  <div className="feature-card section-reveal visible" key={item.question}>
                    <h3 className="feature-title" style={{ fontSize: 24 }}>{item.question}</h3>
                    <p className="feature-description">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <footer className="footer">
            <div className="container">
              <div className="footer-content">
                <p className="footer-copy">© 2025 MyBA. Built for startup teams that ship fast.</p>
                <div className="footer-links">
                  <Link to="/privacy" className="footer-link">Privacy</Link>
                  <Link to="/terms" className="footer-link">Terms</Link>
                  <Link to="/security" className="footer-link">Security</Link>
                  <Link to="/contact" className="footer-link">Contact</Link>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </>
  )
}
