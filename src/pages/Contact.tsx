import React, { FC, useState } from "react";
import { Link } from "react-router-dom";

const 5 = [];

const Contact: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // In a real application, you would send this data to a Supabase Edge Function
    // or another backend service for processing (e.g., sending an email).
    try {
      // const response = await fetch('/api/contact', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ name, email, message }),
      // });
      // if (!response.ok) throw new Error('Failed to send message');
      // const data = await response.json();
      // console.log('Message sent:', data);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch (e: any) {
      setError('Failed to send message. Please try again later.');
      console.error('Contact form submission error:', e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4" style={{ backgroundColor: 'var(--c-bg-dark)' }}>
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md" style={{ backgroundColor: 'var(--c-surface)', borderRadius: 'var(--radius)' }}>
        <h1 className="text-3xl font-bold text-center mb-6" style={{ color: 'var(--c-fg-light)' }}>Contact Us</h1>
        {submitted ? (
          <div className="text-center">
            <p className="text-lg text-green-500 mb-4">Thank you for your message! We'll get back to you soon.</p>'
            <Link to="/" className="px-6 py-3 rounded-md font-semibold transition-colors duration-200" style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-on-primary)' }}>
              Back to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-300 text-sm font-semibold mb-2" style={{ color: 'var(--c-fg-muted)' }}>Name</label>
              <input
                type="text"
                id="name"
                className="w-full px-4 py-2 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-primary-500" style={{ backgroundColor: 'var(--c-input-bg)', color: 'var(--c-fg-light)', borderColor: 'var(--c-border)' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-300 text-sm font-semibold mb-2" style={{ color: 'var(--c-fg-muted)' }}>Email</label>
              <input
                type="email"
                id="email"
                className="w-full px-4 py-2 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-primary-500" style={{ backgroundColor: 'var(--c-input-bg)', color: 'var(--c-fg-light)', borderColor: 'var(--c-border)' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-6">
              <label htmlFor="message" className="block text-gray-300 text-sm font-semibold mb-2" style={{ color: 'var(--c-fg-muted)' }}>Message</label>
              <textarea
                id="message"
                rows={5}
                className="w-full px-4 py-2 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-primary-500" style={{ backgroundColor: 'var(--c-input-bg)', color: 'var(--c-fg-light)', borderColor: 'var(--c-border)' }}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              ></textarea>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-md font-semibold transition-colors duration-200"
              style={{ backgroundColor: 'var(--c-primary)', color: 'var(--c-on-primary)' }}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-gray-400" style={{ color: 'var(--c-fg-muted)' }}>
          Or email us directly at <a href="mailto:support@yourdomain.com" className="font-semibold" style={{ color: 'var(--c-primary)' }}>support@yourdomain.com</a>
        </p>
      </div>
    </div>
  );
};
export default Contact;