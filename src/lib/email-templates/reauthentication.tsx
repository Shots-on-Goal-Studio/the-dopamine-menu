import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirm reauthentication</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '30px',
  fontWeight: 'bold' as const,
  color: '#1A1A2E',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#1A1A2E', margin: '30px 0 0' }
