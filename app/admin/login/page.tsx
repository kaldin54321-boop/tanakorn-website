"use client";

import {
  FormEvent,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";


export default function AdminLoginPage() {
  const supabase = createClient();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);


  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);


    const {
      error: loginError,
    } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });


    if (loginError) {
      setError(
        "Invalid email or password."
      );

      setLoading(false);

      return;
    }


    window.location.href =
      "/admin";
  }


  return (
    <main className="admin-login-page">

      <div className="admin-login-card">

        <div className="admin-logo-mark">
          F
        </div>


        <p className="admin-login-eyebrow">
          WINLATOR@FROST
        </p>


        <h1>
          Admin Login
        </h1>


        <p className="admin-login-description">
          Sign in to manage releases,
          news and files.
        </p>


        <form
          onSubmit={handleLogin}
          className="admin-login-form"
        >

          <label>
            Email

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="admin@example.com"
              autoComplete="email"
              required
            />
          </label>


          <label>
            Password

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Password"
              autoComplete="current-password"
              required
            />
          </label>


          {error && (
            <div className="admin-login-error">
              {error}
            </div>
          )}


          <button
            type="submit"
            className="button-primary"
            disabled={loading}
          >
            {loading
              ? "Signing In..."
              : "Sign In"}
          </button>

        </form>

      </div>

    </main>
  );
}