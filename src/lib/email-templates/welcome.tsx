import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Dopamine Menu'
const SITE_URL = 'https://dopamine.shotsongoal.studio'

const WelcomeEmail = () => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to the Dopamine Menu — healthy hits, on tap.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={kicker}>NOW SERVING</Text>
        <Heading style={h1}>
          Welcome to the<br />Dopamine Menu.
        </Heading>

        <Section style={card}>
          <Text style={text}>
            A personal, gamified menu of healthy dopamine sources. When your
            brain is screaming for a hit — open the menu, pick something,
            log it. Build a streak. Beat the scroll.
          </Text>
        </Section>

        <Heading as="h2" style={h2}>How it works</Heading>
        <Text style={text}>
          <strong>1.</strong> Open your menu. Quick Hits (2 min), Medium Wins
          (15 min), or Big Indulgences (1 hour).
        </Text>
        <Text style={text}>
          <strong>2.</strong> Pick one — or hit the dice and let chance decide.
        </Text>
        <Text style={text}>
          <strong>3.</strong> Do it. Log it. Watch your streak grow.
        </Text>

        <Section style={ctaWrap}>
          <Button href={`${SITE_URL}/menu`} style={cta}>
            OPEN MY MENU →
          </Button>
        </Section>

        <Section style={noteCard}>
          <Text style={noteKicker}>ONE MORE THING</Text>
          <Text style={text}>
            We'll send one short email each morning with a random pick from
            your menu — a little nudge to make today a bit better. You can
            turn it off any time in <strong>Account → Daily reminder email</strong>.
          </Text>
        </Section>

        <Text style={signoff}>
          Pick something good,<br />
          <span style={signoffName}>The {SITE_NAME}</span>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to the Dopamine Menu',
  displayName: 'Welcome',
  previewData: {},
} satisfies TemplateEntry

// --- styles (always white body background) ---
const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: '"DM Mono", "SF Mono", Menlo, monospace',
  margin: 0,
  padding: '40px 0',
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 28px',
  backgroundColor: '#FFF4E0',
  border: '3px solid #1A1A2E',
}
const kicker: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.4em',
  color: '#FF2E63',
  margin: '0 0 12px',
  textTransform: 'uppercase',
}
const h1: React.CSSProperties = {
  fontFamily: '"Bungee", Impact, sans-serif',
  fontSize: '40px',
  lineHeight: 1.05,
  color: '#1A1A2E',
  margin: '0 0 24px',
  textShadow: '4px 4px 0 #FFCB47',
}
const h2: React.CSSProperties = {
  fontFamily: '"Bungee", Impact, sans-serif',
  fontSize: '18px',
  color: '#1A1A2E',
  margin: '32px 0 12px',
  letterSpacing: '0.05em',
}
const card: React.CSSProperties = {
  backgroundColor: '#08D9D6',
  border: '3px solid #1A1A2E',
  padding: '18px 20px',
  margin: '12px 0 8px',
}
const noteCard: React.CSSProperties = {
  backgroundColor: '#FFCB47',
  border: '3px solid #1A1A2E',
  padding: '18px 20px',
  margin: '32px 0 24px',
}
const noteKicker: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.3em',
  color: '#1A1A2E',
  margin: '0 0 8px',
  fontWeight: 700,
  textTransform: 'uppercase',
}
const text: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.6,
  color: '#1A1A2E',
  margin: '0 0 12px',
}
const ctaWrap: React.CSSProperties = {
  textAlign: 'center',
  margin: '28px 0 8px',
}
const cta: React.CSSProperties = {
  backgroundColor: '#1A1A2E',
  color: '#FFCB47',
  fontFamily: '"Bungee", Impact, sans-serif',
  fontSize: '14px',
  letterSpacing: '0.18em',
  padding: '16px 28px',
  textDecoration: 'none',
  display: 'inline-block',
  border: '3px solid #1A1A2E',
}
const signoff: React.CSSProperties = {
  fontFamily: '"DM Serif Display", Georgia, serif',
  fontStyle: 'italic',
  fontSize: '16px',
  color: '#1A1A2E',
  margin: '32px 0 0',
}
const signoffName: React.CSSProperties = {
  fontFamily: '"Bungee", Impact, sans-serif',
  fontStyle: 'normal',
  fontSize: '14px',
  letterSpacing: '0.08em',
}
