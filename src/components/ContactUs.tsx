import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
const escapeHtml = (value: string): string => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
)

const ContactUs: React.FC = () => {  const user = null;  const contactRecipient = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState(user?.email || '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email)
    }
  }, [user?.email])

  const canSend = useMemo(() => {    return Boolean(contactRecipient)  }, [user, contactRecipient])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!contactRecipient) {
      setStatus('error')
      setError('Contact email is not configured. Set VITE_CONTACT_EMAIL in .env.local.')
      return
    }

    if (!supabase) {
      setStatus('error')
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }

    if (!email || !message) {
      setStatus('error')
      setError('Email and message are required.')
      return
    }

    setStatus('sending')

    const senderName = name.trim() || 'Anonymous'
    const safeMessage = escapeHtml(message.trim())
    const safeEmail = escapeHtml(email.trim())
    const safeSubject = escapeHtml(subject.trim() || `New message from ${ senderName }`)
    const htmlBody = `
      <h2>Contact request</h2>
      <p><strong>Name:</strong> ${ senderName }</p>
      <p><strong>Email:</strong> ${ safeEmail }</p>
      <p><strong>Message:</strong></p>
      <p>${ safeMessage.replace(/\\n/g, '<br />') }</p>
    `
    const textBody = `Contact request\n\nName: ${ senderName }\nEmail: ${ email.trim() }\n\n${ message.trim() }`

    const { error: sendError } = await supabase.functions.invoke('send-email', {
      body: {
        to: [contactRecipient],
        subject: safeSubject,
        html: htmlBody,
        text: textBody,
      },
    })

    if (sendError) {
      setStatus('error')
      setError(sendError.message || 'Failed to send message.')
      return
    }

    setStatus('sent')
    setName('')
    setSubject('')
    setMessage('')
  }

  return (
    <section id="contact" className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Contact Us
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Let&#39;s build something together
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Send a message and our team will reach out with next steps, timelines, or a tailored demo.
            </p>
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">What you get</h3>
              <ul className="mt-4 space-y-3 text-slate-600">
                <li className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  Response within 24 hours during business days.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  Clear guidance on setup, pricing, and onboarding.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  Direct access to integration specialists.
                </li>
              </ul>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="contact-name">
                  Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="contact-email">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="contact-subject">
                  Subject
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Project inquiry"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="contact-message">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="mt-2 min-h-[140px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Tell us about your goals and timeline."
                  required
                />
              </div>
            </div>            {user && !contactRecipient && (
              <p className="mt-4 text-sm text-amber-600">
                Set <span className="font-semibold">VITE_CONTACT_EMAIL</span> to receive contact requests.
              </p>
            )}
            {error && (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            )}
            {status === 'sent' && (
              <p className="mt-4 text-sm text-emerald-600">Message sent successfully.</p>
            )}

            <button
              type="submit"
              disabled={!canSend || status === 'sending'}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {status === 'sending' ? 'Sending...' : 'Send message'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

export default ContactUs
