"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function ContactUs() {
  const { userProfile } = useAuth();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, "contact-queries"), {
        name: form.name,
        email: userProfile?.email || "",
        phone: form.phone,
        message: form.message,
        status: "pending",
        createdAt: Timestamp.now(),
        uid: userProfile?.uid || null,
      });

      toast({
        title: "Message sent successfully",
        description: "We'll get back to you as soon as possible.",
      });

      setForm({ name: "", phone: "", message: "" });
    } catch (error: any) {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="max-w-xl mx-auto px-4 py-10 bg-card text-card-foreground rounded-xl shadow-md animate-slideUpFadeIn space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="text-3xl font-bold text-center">Customer Support</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div className="space-y-1">
          <label
            htmlFor="name"
            className="text-sm font-medium text-muted-foreground"
          >
            Your Name
          </label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full p-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="text-sm font-medium text-muted-foreground"
          >
            Your Email
          </label>
          <input
            id="email"
            type="email"
            value={userProfile?.email || ""}
            readOnly
            className="w-full p-3 rounded-md bg-muted border border-border text-sm text-muted-foreground"
          />
        </div>

        {/* Phone  */}
        <div className="space-y-1">
          <label
            htmlFor="phone"
            className="text-sm font-medium text-muted-foreground"
          >
            Phone Number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            required
            className="w-full p-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Message */}
        <div className="space-y-1">
          <label
            htmlFor="message"
            className="text-sm font-medium text-muted-foreground"
          >
            Your Message
          </label>
          <textarea
            id="message"
            name="message"
            value={form.message}
            onChange={handleChange}
            rows={4}
            required
            className="w-full p-3 rounded-md bg-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-md font-semibold hover:opacity-90 transition-opacity"
        >
          {loading ? "Sending..." : "Send Message"}
        </button>
      </form>
    </motion.div>
  );
}
