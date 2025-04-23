import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { loginSchema, registerSchema } from "@/schemas/auth";
import { Redirect } from "wouter";
import { z } from "zod";
import { AnimatedLogo } from "@/components/ui/animated-logo";

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register, isAuthenticated } = useAuth();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: ""
    }
  });

  const onLoginSubmit = async (data: LoginFormData) => {
    try {
      await login(data.username, data.password);
    } catch (error) {
      console.error("Erro ao fazer login:", error);
    }
  };

  const onRegisterSubmit = async (data: RegisterFormData) => {
    try {
      await register({
        username: data.username,
        name: data.name,
        email: data.email,
        password: data.password
      });
    } catch (error) {
      console.error("Erro ao registrar:", error);
    }
  };

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <AnimatedLogo className="mb-8" />
        
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-[#1E293B]">
            {isLogin ? "Entre na sua conta" : "Crie sua conta"}
          </h2>
          <p className="mt-2 text-sm text-[#64748B]">
            {isLogin ? (
              <>
                Ou{" "}
                <button
                  onClick={() => setIsLogin(false)}
                  className="font-medium text-[#22C55E] hover:text-[#16A34A]"
                >
                  crie uma nova conta
                </button>
              </>
            ) : (
              <>
                Já tem uma conta?{" "}
                <button
                  onClick={() => setIsLogin(true)}
                  className="font-medium text-[#22C55E] hover:text-[#16A34A]"
                >
                  Entre aqui
                </button>
              </>
            )}
          </p>
        </div>

        <div className="mt-8">
          {isLogin ? (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-[#1E293B]">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  {...loginForm.register("username")}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[#1E293B] placeholder-[#94A3B8] focus:border-[#22C55E] focus:outline-none focus:ring-1 focus:ring-[#22C55E] sm:text-sm"
                  placeholder="Digite seu username"
                />
                {loginForm.formState.errors.username && (
                  <p className="mt-1 text-sm text-red-600">
                    {loginForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#1E293B]">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  {...loginForm.register("password")}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[#1E293B] placeholder-[#94A3B8] focus:border-[#22C55E] focus:outline-none focus:ring-1 focus:ring-[#22C55E] sm:text-sm"
                  placeholder="Digite sua senha"
                />
                {loginForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-600">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loginForm.formState.isSubmitting}
                className="w-full rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-medium text-white hover:bg-[#16A34A] focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:ring-offset-2 disabled:opacity-50"
              >
                {loginForm.formState.isSubmitting ? "Entrando..." : "Entrar"}
              </button>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-[#1E293B]">
                  Nome
                </label>
                <input
                  id="name"
                  type="text"
                  {...registerForm.register("name")}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[#1E293B] placeholder-[#94A3B8] focus:border-[#22C55E] focus:outline-none focus:ring-1 focus:ring-[#22C55E] sm:text-sm"
                  placeholder="Digite seu nome completo"
                />
                {registerForm.formState.errors.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {registerForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-[#1E293B]">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  {...registerForm.register("username")}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[#1E293B] placeholder-[#94A3B8] focus:border-[#22C55E] focus:outline-none focus:ring-1 focus:ring-[#22C55E] sm:text-sm"
                  placeholder="Digite seu username"
                />
                {registerForm.formState.errors.username && (
                  <p className="mt-1 text-sm text-red-600">
                    {registerForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="register-email" className="block text-sm font-medium text-[#1E293B]">
                  Email
                </label>
                <input
                  id="register-email"
                  type="email"
                  {...registerForm.register("email")}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[#1E293B] placeholder-[#94A3B8] focus:border-[#22C55E] focus:outline-none focus:ring-1 focus:ring-[#22C55E] sm:text-sm"
                  placeholder="Digite seu email"
                />
                {registerForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {registerForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="register-password" className="block text-sm font-medium text-[#1E293B]">
                  Senha
                </label>
                <input
                  id="register-password"
                  type="password"
                  {...registerForm.register("password")}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[#1E293B] placeholder-[#94A3B8] focus:border-[#22C55E] focus:outline-none focus:ring-1 focus:ring-[#22C55E] sm:text-sm"
                  placeholder="Crie uma senha"
                />
                {registerForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-600">
                    {registerForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-[#1E293B]">
                  Confirmar Senha
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  {...registerForm.register("confirmPassword")}
                  className="mt-1 block w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[#1E293B] placeholder-[#94A3B8] focus:border-[#22C55E] focus:outline-none focus:ring-1 focus:ring-[#22C55E] sm:text-sm"
                  placeholder="Confirme sua senha"
                />
                {registerForm.formState.errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    {registerForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={registerForm.formState.isSubmitting}
                className="w-full rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-medium text-white hover:bg-[#16A34A] focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:ring-offset-2 disabled:opacity-50"
              >
                {registerForm.formState.isSubmitting ? "Criando conta..." : "Criar conta"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
