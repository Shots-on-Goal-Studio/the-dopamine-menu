import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your login link</Heading>
        <Text style={text}>
          Click the button below to log in to {siteName}. This link will expire
          shortly.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Log In
        </Button>
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"DM Mono", Menlo, monospace', padding: '40px 0' }
const container = { maxWidth: '560px', padding: '32px 28px', backgroundColor: '#FFF4E0', border: '3px solid #1A1A2E' }
const h1 = {
  fontSize: '30px',
  fontFamily: '"Bungee", Impact, sans-serif',
  fontWeight: 'bold' as const,
  color: '#1A1A2E',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#1A1A2E',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#1A1A2E',
  color: '#FFCB47',
  fontSize: '14px',
  border: '3px solid #1A1A2E',
  borderRadius: '0px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#1A1A2E', margin: '30px 0 0' }
