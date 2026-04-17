import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Financial Literacy Quiz - Computer Science Department',
  description: 'A demo quiz application for Ayan.ai proctoring integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="quiz-container">
          {children}
        </div>
      </body>
    </html>
  )
}