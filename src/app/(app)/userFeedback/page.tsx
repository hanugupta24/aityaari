"use client";

import { useState } from "react";
import emailjs from "@emailjs/browser";
import { motion } from "framer-motion";

export default function FeedbackPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);

  const sendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    emailjs
      .send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID_FEEDBACK!,
        {
          from_name: form.name,
          from_email: form.email,
          message: form.message,
        },
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
      )
      .then(
        () => {
          alert("Message sent successfully.");
          setForm({ name: "", email: "", message: "" });
        },
        (error) => {
          alert("Something went wrong. Please try again.");
          console.error(error);
        }
      )
      .finally(() => setLoading(false));
  };

  return (
    <motion.div className="max-w-xl mx-auto px-4 py-10 space-y-6 bg-card text-card-foreground rounded-xl shadow-md animate-slideUpFadeIn">
      <h2 className="text-3xl font-bold">Feedback</h2>
      <form onSubmit={sendEmail} className="space-y-4">
        <input
          className="w-full p-3 rounded-md bg-input border"
          placeholder="Your Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="w-full p-3 rounded-md bg-input border"
          type="email"
          placeholder="Your Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <textarea
          className="w-full p-3 h-32 rounded-md bg-input border"
          placeholder="Your Message"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          required
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground py-3 px-6 rounded-md font-semibold hover:opacity-90"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Message"}
        </button>
      </form>
    </motion.div>
  );
}
