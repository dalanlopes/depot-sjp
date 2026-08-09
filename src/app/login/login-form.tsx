"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "password" | "create_password" | "requested" | "inactive";

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetToEmail() {
    setStep("email");
    setSenha("");
    setConfirmarSenha("");
    setCodigo("");
    setError(null);
  }

  async function handleCheckEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Não foi possível continuar. Tente novamente.");
        return;
      }
      if (data.status === "has_password") setStep("password");
      else if (data.status === "first_access") setStep("create_password");
      else if (data.status === "requested") setStep("requested");
      else if (data.status === "inactive") setStep("inactive");
    } catch {
      setLoading(false);
      setError("Erro ao conectar. Tente novamente.");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "E-mail ou senha inválidos.");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Erro ao conectar. Tente novamente.");
      setLoading(false);
    }
  }

  async function handleCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!codigo.trim()) {
      setError("Informe o código de convite enviado pelo administrador.");
      return;
    }
    if (senha.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha, codigo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Não foi possível criar a senha.");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Erro ao conectar. Tente novamente.");
      setLoading(false);
    }
  }

  if (step === "requested") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--foreground)] bg-amber-50 rounded-lg px-3 py-3">
          Solicitação enviada para <strong>{email}</strong>. Peça para o administrador
          liberar o seu acesso na tela de Usuários. Depois disso, volte aqui para criar
          sua senha.
        </p>
        <button type="button" onClick={resetToEmail} className="btn btn-primary w-full">
          Tentar outro e-mail
        </button>
      </div>
    );
  }

  if (step === "inactive") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--danger)] bg-red-50 rounded-lg px-3 py-3">
          Sua conta está desativada. Fale com o administrador do sistema.
        </p>
        <button type="button" onClick={resetToEmail} className="btn btn-primary w-full">
          Tentar outro e-mail
        </button>
      </div>
    );
  }

  if (step === "create_password") {
    return (
      <form onSubmit={handleCreatePassword} className="space-y-4">
        <p className="text-sm text-[var(--muted)]">
          Primeiro acesso de <strong>{email}</strong>. Peça o código de convite para o
          administrador e crie sua senha para continuar.
        </p>
        <div>
          <label className="text-sm font-medium block mb-1.5">Código de convite</label>
          <input
            className="input uppercase tracking-widest font-mono"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="Ex: K3F9QX2A"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Nova senha</label>
          <input
            type="password"
            className="input"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Confirmar senha</label>
          <input
            type="password"
            className="input"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        {error && (
          <p className="text-sm text-[var(--danger)] bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-60">
          {loading ? "Salvando..." : "Criar senha e entrar"}
        </button>
        <button type="button" onClick={resetToEmail} className="text-sm text-[var(--muted)] hover:underline w-full text-center">
          Usar outro e-mail
        </button>
      </form>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1.5">E-mail</label>
          <input type="email" className="input bg-gray-50" value={email} disabled />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Senha</label>
          <input
            type="password"
            className="input"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
            autoFocus
          />
        </div>
        {error && (
          <p className="text-sm text-[var(--danger)] bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary w-full disabled:opacity-60">
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <button type="button" onClick={resetToEmail} className="text-sm text-[var(--muted)] hover:underline w-full text-center">
          Usar outro e-mail
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCheckEmail} className="space-y-4">
      <div>
        <label className="text-sm font-medium block mb-1.5">E-mail</label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          autoFocus
        />
      </div>
      {error && (
        <p className="text-sm text-[var(--danger)] bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary w-full disabled:opacity-60"
      >
        {loading ? "Verificando..." : "Continuar"}
      </button>
    </form>
  );
}
