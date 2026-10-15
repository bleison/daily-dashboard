"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export async function signIn(form: FormData){const email=String(form.get("email")||"").trim();const password=String(form.get("password")||"");const s=await createClient();const {error}=await s.auth.signInWithPassword({email,password});if(error)redirect("/anmelden?fehler=1");redirect("/dashboard");}
export async function signUp(form: FormData){const email=String(form.get("email")||"").trim();const password=String(form.get("password")||"");if(password.length<12)redirect("/registrieren?fehler=1");const s=await createClient();const {error}=await s.auth.signUp({email,password,options:{emailRedirectTo:`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`}});if(error)redirect("/registrieren?fehler=1");redirect("/registrieren?gesendet=1");}
export async function signOut(){const s=await createClient();await s.auth.signOut();redirect("/");}
