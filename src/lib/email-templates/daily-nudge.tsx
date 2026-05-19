import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_URL = 'https://dopamine.shotsongoal.studio'

const CATEGORY_LABEL: Record<string, { title: string; time: string; color: string }> = {
  quick: { title: 'Quick Hit', time: '2 min', color: '#08D9D6' },
  medium: { title: 'Medium Win', time: '15 min', color: '#FFCB47' },
  big: { title: 'Big Indulgence', time: '1 hour', color: '#FF2E63' },
}

interface DailyNudgeProps {
  itemName?: string
  detail?: string
  category?: 'quick' | 'medium' | 'big'
  isCustom?: boolean
}

const DailyNudgeEmail = ({
  itemName = 'Stretch for 60 seconds',
  detail = 'Just your shoulders.',
  category = 'quick',
  isCustom = false,
}: DailyNudgeProps) => {
  const cat = CATEGORY_LABEL[category] ?? CATEGORY_LABEL.quick
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Nudge: {itemName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={kicker}>QUICK NUDGE</Text>
          <Heading style={h1}>One more<br />from your menu.</Heading>

          <Section style={{ ...card, backgroundColor: cat.color }}>
            <Text style={cardKicker}>
              {cat.title} · ~ {cat.time}
              {isCustom ? ' · YOUR OWN' : ''}
            </Text>
            <Text style={cardTitle}>{itemName}</Text>
            {detail ? <Text style={cardDetail}>{detail}</Text> : null}
          </Section>

          <Section style={ctaWrap}>
            <Button href={`${SITE_URL}/menu`} style={cta}>
              OPEN MY MENU →
            </Button>
          </Section>

          <Text style={footer}>
            Too many nudges? Tune them in{' '}
            <a href={`${SITE_URL}/account`} style={link}>Account</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DailyNudgeEmail,
  subject: (data: Record<string, any>) =>
    data?.itemName ? `Nudge: ${data.itemName}` : 'A little nudge from your menu',
  displayName: 'Daily nudge (extra)',
  previewData: {
    itemName: 'Drink a glass of water',
    detail: 'Cold, slow sips.',
    category: 'quick',
    isCustom: false,
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: '"DM Mono", "SF Mono", Menlo, monospace',
  margin: 0,
  padding: '40px 0',
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '28px 26px',
  backgroundColor: '#FFF4E0',
  border: '3px solid #1A1A2E',
}
const kicker: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.4em',
  color: '#FF2E63',
  margin: '0 0 10px',
  textTransform: 'uppercase',
}
const h1: React.CSSProperties = {
  fontFamily: '"Bungee", Impact, sans-serif',
  fontSize: '30px',
  lineHeight: 1.05,
  color: '#1A1A2E',
  margin: '0 0 20px',
  textShadow: '4px 4px 0 #FFCB47',
}
const card: React.CSSProperties = {
  border: '3px solid #1A1A2E',
  padding: '20px 20px 22px',
  margin: '4px 0 18px',
}
const cardKicker: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.3em',
  color: '#1A1A2E',
  margin: '0 0 8px',
  fontWeight: 700,
  textTransform: 'uppercase',
}
const cardTitle: React.CSSProperties = {
  fontFamily: '"DM Serif Display", Georgia, serif',
  fontSize: '24px',
  lineHeight: 1.2,
  color: '#1A1A2E',
  margin: '0 0 6px',
}
const cardDetail: React.CSSProperties = {
  fontFamily: '"DM Serif Display", Georgia, serif',
  fontStyle: 'italic',
  fontSize: '15px',
  color: '#1A1A2E',
  margin: 0,
  opacity: 0.85,
}
const ctaWrap: React.CSSProperties = { textAlign: 'center', margin: '8px 0 4px' }
const cta: React.CSSProperties = {
  backgroundColor: '#1A1A2E',
  color: '#FFCB47',
  fontFamily: '"Bungee", Impact, sans-serif',
  fontSize: '14px',
  letterSpacing: '0.18em',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
  border: '3px solid #1A1A2E',
}
const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#1A1A2E',
  opacity: 0.6,
  margin: '22px 0 0',
  textAlign: 'center',
}
const link: React.CSSProperties = {
  color: '#FF2E63',
  textDecoration: 'underline',
}
