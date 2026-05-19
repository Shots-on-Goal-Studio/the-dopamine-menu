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

interface DailyReminderProps {
  itemName?: string
  detail?: string
  category?: 'quick' | 'medium' | 'big'
  isCustom?: boolean
}

const DailyReminderEmail = ({
  itemName = 'Step outside, look at the sky',
  detail = 'Sun + sky reset',
  category = 'quick',
  isCustom = false,
}: DailyReminderProps) => {
  const cat = CATEGORY_LABEL[category] ?? CATEGORY_LABEL.quick
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Today's pick: {itemName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={kicker}>TODAY'S SPECIAL</Text>
          <Heading style={h1}>One hit from<br />your menu.</Heading>

          <Section style={{ ...card, backgroundColor: cat.color }}>
            <Text style={cardKicker}>
              {cat.title} · ~ {cat.time}
              {isCustom ? ' · YOUR OWN' : ''}
            </Text>
            <Text style={cardTitle}>{itemName}</Text>
            {detail ? <Text style={cardDetail}>{detail}</Text> : null}
          </Section>

          <Text style={subtle}>
            Don't feel it? <em>Roll the dice</em> for a different one — or pick
            anything else from your menu.
          </Text>

          <Section style={ctaWrap}>
            <Button href={`${SITE_URL}/menu`} style={cta}>
              OPEN MY MENU →
            </Button>
          </Section>

          <Section style={promoCard}>
            <Text style={promoKicker}>MORE TOOLS FOR THE ADHD BRAIN</Text>
            <Text style={promoTitle}>Meet Daily Three</Text>
            <Text style={promoText}>
              Pick three things that matter today. Do those. That's it.
            </Text>
            <a href="https://dailythree.shotsongoal.studio/" style={promoLink}>
              Try Daily Three →
            </a>
          </Section>

          <Text style={footer}>
            Daily reminders can be turned off in{' '}
            <a href={`${SITE_URL}/account`} style={link}>
              Account
            </a>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DailyReminderEmail,
  subject: (data: Record<string, any>) =>
    data?.itemName ? `Today's pick: ${data.itemName}` : "Today's pick from your menu",
  displayName: 'Daily reminder',
  previewData: {
    itemName: 'Walk around the block',
    detail: 'No phone. Just walk.',
    category: 'medium',
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
  fontSize: '38px',
  lineHeight: 1.05,
  color: '#1A1A2E',
  margin: '0 0 24px',
  textShadow: '4px 4px 0 #FFCB47',
}
const card: React.CSSProperties = {
  border: '3px solid #1A1A2E',
  padding: '22px 22px 24px',
  margin: '8px 0 20px',
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
  fontSize: '26px',
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
const subtle: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.55,
  color: '#1A1A2E',
  margin: '8px 0 8px',
  opacity: 0.85,
}
const ctaWrap: React.CSSProperties = {
  textAlign: 'center',
  margin: '20px 0 8px',
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
const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#1A1A2E',
  opacity: 0.6,
  margin: '28px 0 0',
  textAlign: 'center',
}
const link: React.CSSProperties = {
  color: '#FF2E63',
  textDecoration: 'underline',
}
const promoCard: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #1A1A2E',
  padding: '16px 18px',
  margin: '24px 0 8px',
}
const promoKicker: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.3em',
  color: '#1A1A2E',
  opacity: 0.6,
  margin: '0 0 8px',
  fontWeight: 700,
  textTransform: 'uppercase',
}
const promoTitle: React.CSSProperties = {
  fontFamily: '"DM Serif Display", Georgia, serif',
  fontSize: '18px',
  lineHeight: 1.2,
  color: '#1A1A2E',
  margin: '0 0 4px',
}
const promoText: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: 1.5,
  color: '#1A1A2E',
  opacity: 0.8,
  margin: '0 0 10px',
}
const promoLink: React.CSSProperties = {
  fontSize: '13px',
  color: '#FF2E63',
  textDecoration: 'underline',
  fontWeight: 700,
}
