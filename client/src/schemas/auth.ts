import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(3, 'O usuário deve ter no mínimo 3 caracteres'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
});

export const registerSchema = z.object({
  username: z.string().min(3, 'O usuário deve ter no mínimo 3 caracteres'),
  name: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
}); 