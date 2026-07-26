import React, { useState, useMemo, useEffect, useRef } from "react";
import { Camera, Mic, Type, ChevronLeft, MessageCircle, Check, Plus, Mail, LogOut, Loader2 } from "lucide-react";
import {
  signInWithGoogle,
  getStoredSession,
  storeSession,
  clearStoredSession,
} from "./lib/googleAuth";
import { saveSession, loadSession, logPaidPlanRequest } from "./lib/sheetsApi";
import { openWhatsAppPaidPlanRequest } from "./lib/whatsapp";
import { COACH_PLAN_PRICE } from "./config";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// NOTA: esta versión agrega `recharts` como dependencia nueva.
// Si tu proyecto no lo tiene instalado: npm install recharts

// ---- Design tokens ----
const C = {
  paper: "#F7F1E6",
  paperSoft: "#EFE7D8",
  ink: "#2B2620",
  inkSoft: "#6B6357",
  plum: "#6E4359",
  plumDeep: "#4E2E3D",
  sage: "#6B7F5B",
  sageSoft: "#DCE3D2",
  clay: "#C97A56",
  rose: "#E9CEC6",
  roseDeep: "#B98277",
  line: "#DDD2BE",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&display=swap');

/* ---- Reset responsive: evita que nada se salga de la pantalla en iPhone chicos ---- */
*, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; width: 100%; overflow-x: hidden; background: ${C.paper}; }
#root { width: 100%; overflow-x: hidden; }
img, svg { max-width: 100%; }
input, button { font-size: 16px; } /* evita zoom automático de iOS al enfocar inputs */

.f-display { font-family: 'Fraunces', serif; }
.f-body { font-family: 'Work Sans', sans-serif; }

.spin { animation: almenta-spin 0.8s linear infinite; }
@keyframes almenta-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ---- Animaciones estilo React: entrada de pantallas, tabs y tarjetas ---- */
@keyframes almenta-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes almenta-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes almenta-pop {
  0% { opacity: 0; transform: scale(0.94); }
  100% { opacity: 1; transform: scale(1); }
}
.screen-enter { animation: almenta-fade-up 0.32s cubic-bezier(.22,.61,.36,1) both; }
.tab-panel-enter { animation: almenta-pop 0.24s cubic-bezier(.22,.61,.36,1) both; }
.list-item-enter { animation: almenta-fade-up 0.3s cubic-bezier(.22,.61,.36,1) both; }

.almenta-btn { transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease; }
.almenta-btn:active { transform: scale(0.97); }

.almenta-tab { transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.15s ease; }
.almenta-tab:active { transform: scale(0.96); }

summary::-webkit-details-marker { display: none; }
summary::marker { content: ""; }

/* ---- Ajustes finos para pantallas angostas (iPhone mini/SE, ~375px o menos) ---- */
@media (max-width: 380px) {
  .almenta-shell { padding-left: 16px !important; padding-right: 16px !important; }
  .almenta-4field-grid { grid-template-columns: 1fr 1fr !important; }
}
@media (max-width: 340px) {
  .almenta-3col { grid-template-columns: 1fr !important; }
}
`;

// ---------------- LÓGICA REAL DE PLAN Y DATOS ----------------

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
// Lunes = 0 ... Domingo = 6
const TODAY_IDX = (new Date().getDay() + 6) % 7;

const QUICK_FOODS = [
  { name: "Milanesa con puré", kcal: 450, protein: 30, carbs: 40, fat: 18, tags: ["frito", "harinas refinadas", "graso"] },
  { name: "Ensalada con pollo", kcal: 350, protein: 35, carbs: 15, fat: 12, tags: ["proteína magra", "fibra"] },
  { name: "Yogur con granola", kcal: 250, protein: 10, carbs: 35, fat: 7, tags: ["azúcar simple", "lácteo"] },
  { name: "Sandwich de jamón y queso", kcal: 400, protein: 20, carbs: 45, fat: 14, tags: ["harinas refinadas", "lácteo", "embutido"] },
  { name: "Tostado + café con leche", kcal: 300, protein: 12, carbs: 40, fat: 9, tags: ["harinas refinadas", "lácteo"] },
  { name: "Asado con ensalada", kcal: 520, protein: 40, carbs: 8, fat: 35, tags: ["graso", "proteína magra"] },
];

// Cómo se sintió el cuerpo después de comer, y qué combinación de tags suele
// generar eso. Es una simplificación con fines de prototipo, no un diagnóstico.
const SYMPTOMS = [
  {
    key: "pesadez",
    label: "Pesadez",
    emoji: "🥱",
    negative: true,
    tissue: "gut",
    culpritTags: ["frito", "graso", "harinas refinadas"],
    explanation:
      "Las frituras y las harinas refinadas hacen que el estómago tarde más en vaciarse. Esa digestión lenta es la pesadez que sentís después de comer.",
  },
  {
    key: "hinchazon",
    label: "Hinchazón",
    emoji: "🎈",
    negative: true,
    tissue: "gut",
    culpritTags: ["lácteo", "harinas refinadas", "embutido"],
    explanation:
      "Los lácteos, las harinas refinadas y los embutidos pueden generar más gas durante la digestión. Eso se siente como hinchazón abdominal.",
  },
  {
    key: "bajon",
    label: "Bajón de energía",
    emoji: "🔋",
    negative: true,
    tissue: "energia",
    culpritTags: ["azúcar simple", "harinas refinadas"],
    explanation:
      "El azúcar simple genera un pico rápido de glucosa en sangre, seguido de una caída. Ese vaivén es el bajón de energía que sentís después.",
  },
  { key: "liviana", label: "Liviana/o", emoji: "🌿", negative: false },
  { key: "energia", label: "Con energía", emoji: "⚡", negative: false },
];

// Alimentos sugeridos para agregar, según qué tejido/función ayudan a sostener.
const BENEFIT_FOODS = [
  {
    name: "Vegetales de hoja verde",
    benefit: "Aportan fibra que ayuda a que la digestión se mueva más rápido.",
    tissue: "gut",
    kcal: 50,
    protein: 3,
    carbs: 8,
    fat: 0,
  },
  {
    name: "Lácteos fermentados (kéfir, yogur natural)",
    benefit: "Ayudan a tu flora intestinal en vez de inflamarla.",
    tissue: "gut",
    kcal: 120,
    protein: 8,
    carbs: 12,
    fat: 4,
  },
  {
    name: "Proteína magra (pollo, pescado, huevo)",
    benefit: "Sostiene la energía estable, sin los picos de azúcar.",
    tissue: "energia",
    kcal: 200,
    protein: 30,
    carbs: 0,
    fat: 8,
  },
  {
    name: "Frutas frescas enteras",
    benefit: "Dan energía con fibra, sin el pico y la caída del azúcar suelta.",
    tissue: "energia",
    kcal: 80,
    protein: 1,
    carbs: 20,
    fat: 0,
  },
  {
    name: "Frutos secos o palta",
    benefit: "Grasas buenas que cuidan tus arterias sin sobrecargar la digestión.",
    tissue: "organos",
    kcal: 180,
    protein: 4,
    carbs: 8,
    fat: 16,
  },
];

function suggestionsFor(tissue) {
  const matched = BENEFIT_FOODS.filter((f) => f.tissue === tissue);
  return (matched.length ? matched : BENEFIT_FOODS).slice(0, 2);
}

// Contenido de las infografías de bienestar (estilo línea gestual)
const TISSUE_CARDS = [
  {
    key: "huesos",
    title: "Huesos",
    color: C.inkSoft,
    icon: "bone",
    text: "El calcio y la vitamina D (lácteos, huevo, pescado, sol) mantienen tus huesos firmes y ayudan a que no se debiliten con los años.",
  },
  {
    key: "intestino",
    title: "Intestino",
    color: C.sage,
    icon: "gut",
    text: "La fibra de vegetales, frutas y legumbres alimenta a las bacterias buenas de tu intestino. Mejora la digestión y hasta tu ánimo.",
  },
  {
    key: "energia",
    title: "Energía y músculo",
    color: C.clay,
    icon: "spark",
    text: "La proteína repara el tejido muscular, y los carbohidratos complejos te dan una energía estable durante todo el día.",
  },
  {
    key: "organos",
    title: "Corazón y órganos",
    color: C.roseDeep,
    icon: "drop",
    text: "Las grasas buenas (pescado, palta, frutos secos) y los antioxidantes de frutas y verduras protegen tus arterias y tus órganos del desgaste.",
  },
];

// Mifflin-St Jeor + ajuste según objetivo. Es una estimación real, no un mock:
// cambia si cambian peso, altura, edad, sexo u objetivo.
function calcPlan(data) {
  const weight = parseFloat(data.currentWeight) || 70;
  const height = parseFloat(data.height) || 165;
  const age = parseFloat(data.age) || 30;
  const sex = data.sex || "F";

  const bmr =
    sex === "M"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  const ACTIVITY_FACTOR = 1.375; // actividad ligera-moderada, fijo en este prototipo
  const tdee = bmr * ACTIVITY_FACTOR;

  let kcal;
  if (data.goal === "Bajar de peso") kcal = tdee * 0.8;
  else if (data.goal === "Ganar masa muscular") kcal = tdee * 1.1;
  else kcal = tdee;

  const proteinG = Math.round(weight * 2);
  const proteinKcal = proteinG * 4;
  const fatKcal = kcal * 0.25;
  const fatG = Math.round(fatKcal / 9);
  const carbKcal = Math.max(kcal - proteinKcal - fatKcal, 0);
  const carbG = Math.round(carbKcal / 4);

  return { kcal: Math.round(kcal), protein: proteinG, carbs: carbG, fat: fatG };
}

// Historial de peso: los días previos a hoy son simulados (no hay pantalla de
// pesaje diario todavía), pero derivan del peso actual + dirección del objetivo,
// así el gráfico cuenta una historia coherente con lo que la usuaria cargó.
function buildWeightSeries(data) {
  const current = parseFloat(data.currentWeight) || 70;
  const target = parseFloat(data.targetWeight) || current;
  const direction = target < current ? -1 : target > current ? 1 : 0;

  return DAYS.map((d, i) => {
    if (i === TODAY_IDX) return { day: d, weight: current, target };
    if (i > TODAY_IDX) return { day: d, weight: null, target };
    const distance = TODAY_IDX - i;
    const drift = -direction * distance * 0.15;
    return { day: d, weight: Math.round((current + drift) * 10) / 10, target };
  });
}

// Historial de calorías: hoy sale 100% del registro real (foodLog).
// Los días previos son una simulación determinística (misma semilla siempre)
// para poder mostrar un gráfico de "cómo venías" sin necesitar persistencia.
function buildCalorieSeries(foodLog, plan) {
  return DAYS.map((d, i) => {
    if (i === TODAY_IDX) {
      const kcal = (foodLog || [])
        .filter((f) => f.dayIndex === TODAY_IDX)
        .reduce((sum, f) => sum + f.kcal, 0);
      return { day: d, kcal, target: plan.kcal, isToday: true };
    }
    if (i > TODAY_IDX) return { day: d, kcal: null, target: plan.kcal, isToday: false };
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const frac = seed - Math.floor(seed);
    const variance = 0.85 + frac * 0.3;
    return { day: d, kcal: Math.round(plan.kcal * variance), target: plan.kcal, isToday: false };
  });
}

function todayTotals(foodLog) {
  return (foodLog || [])
    .filter((f) => f.dayIndex === TODAY_IDX)
    .reduce(
      (acc, f) => ({
        kcal: acc.kcal + f.kcal,
        protein: acc.protein + f.protein,
        carbs: acc.carbs + f.carbs,
        fat: acc.fat + f.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
}

// ---- Componentes visuales base (sin cambios de estilo) ----

function Scribble({ color = C.clay, width = 120 }) {
  return (
    <svg width={width} height="14" viewBox="0 0 120 14" fill="none" style={{ display: "block" }}>
      <path
        d="M2 9c10-6 20-7 28-3s16 6 26 2 20-8 30-5 18 7 32 3"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function Circle({ color = C.plum, size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none">
      <path
        d="M23 4C33 3 41 10 41 21c0 12-9 21-19 21S3 33 4 21C5 11 13 5 23 4Z"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  );
}

// Íconos de trazo gestual, mismo lenguaje visual que Scribble/Circle:
// líneas sueltas, imperfectas, dibujadas a mano, sin relleno.
function IconBone({ color = C.inkSoft, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none">
      <path
        d="M10 16c-3-1-5 1-5 4s2 4 4 3c1 3 3 5 6 5l16-2c1 3 3 4 5 3s3-3 2-5c2-1 3-3 2-5s-3-3-5-2c-1-3-3-4-6-4l-15 2c-1-3-3-4-5-3s-2 3-1 4"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function IconGut({ color = C.sage, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none">
      <path
        d="M9 10c4-3 9-2 10 2 1 5-6 5-6 9 0 5 8 4 9-1 1-4-2-6-1-10 1-5 7-6 11-3 4 3 5 9 2 13-2 3-6 4-9 3"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function IconSpark({ color = C.clay, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none">
      <path
        d="M25 4 13 25l8-1-3 17 14-22-9 1 2-16Z"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function IconDrop({ color = C.roseDeep, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none">
      <path
        d="M23 6c6 8 13 15 13 22 0 8-6 13-13 13S10 36 10 28c0-7 7-14 13-22Z"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function IconHeart({ color = C.roseDeep, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none">
      <path
        d="M23 39C14 32 6 25 6 16c0-6 5-10 10-9 3 1 6 3 7 6 1-3 4-5 7-6 5-1 10 3 10 9 0 9-8 16-17 23Z"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function IconHands({ color = C.sage, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none">
      <path
        d="M6 22c2-4 5-7 9-7 3 0 4 2 4 4M6 22c0 4 2 7 5 9M40 22c-2-4-5-7-9-7-3 0-4 2-4 4M40 22c0 4-2 7-5 9M19 19c1 5 3 9 4 12 1-3 3-7 4-12"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Guía de referencia rápida: no es un juicio de "bueno/malo" en todos los
// casos (proteína vegetal vs. animal son dos fuentes válidas, no un ranking).
const FOOD_GUIDE = {
  fats: {
    title: "Grasas",
    colA: {
      label: "Saludables",
      color: C.sage,
      items: ["Palta", "Frutos secos y semillas", "Aceite de oliva", "Pescados grasos (salmón, caballa)"],
    },
    colB: {
      label: "Para moderar",
      color: C.roseDeep,
      items: ["Frituras", "Margarina", "Embutidos y fiambres", "Manteca en exceso"],
    },
  },
  proteins: {
    title: "Proteínas",
    colA: {
      label: "Vegetales",
      color: C.sage,
      items: ["Legumbres (lentejas, garbanzos, porotos)", "Tofu y soja", "Quinoa", "Frutos secos"],
    },
    colB: {
      label: "Animales",
      color: C.clay,
      items: ["Pollo y pavo", "Pescado", "Huevo", "Carnes rojas (con moderación)"],
    },
  },
  carbs: {
    title: "Carbohidratos",
    colA: {
      label: "Complejos (recomendados)",
      color: C.sage,
      items: ["Avena", "Batata / camote", "Arroz y pan integral", "Legumbres"],
    },
    colB: {
      label: "Simples (para moderar)",
      color: C.roseDeep,
      items: ["Azúcar y golosinas", "Harinas blancas", "Gaseosas y jugos", "Snacks envasados"],
    },
  },
};

const TISSUE_ICONS = { bone: IconBone, gut: IconGut, spark: IconSpark, drop: IconDrop };

function ProgressDots({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 20 : 6,
            height: 6,
            borderRadius: 4,
            background: i === step ? C.plum : C.line,
            transition: "all .25s ease",
          }}
        />
      ))}
    </div>
  );
}

function PrimaryButton({ children, onClick, style, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="f-body almenta-btn"
      style={{
        width: "100%",
        padding: "14px 20px",
        background: C.plum,
        color: C.paper,
        border: "none",
        borderRadius: 14,
        fontSize: 15,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: 0.2,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="f-body almenta-btn"
      style={{
        width: "100%",
        padding: "12px 20px",
        background: "transparent",
        color: C.inkSoft,
        border: "none",
        fontSize: 14,
        cursor: "pointer",
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </button>
  );
}

function OptionRow({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="f-body almenta-btn"
      style={{
        width: "100%",
        textAlign: "left",
        padding: "14px 16px",
        marginBottom: 10,
        borderRadius: 12,
        border: `1.5px solid ${selected ? C.plum : C.line}`,
        background: selected ? C.sageSoft : "#fff",
        color: C.ink,
        fontSize: 14.5,
        cursor: "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {label}
      {selected && <Check size={16} color={C.plum} />}
    </button>
  );
}

function Header({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, minHeight: 20 }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, marginLeft: -4 }}
        >
          <ChevronLeft size={20} color={C.inkSoft} />
        </button>
      )}
      {title && (
        <span className="f-body" style={{ fontSize: 12, color: C.inkSoft, letterSpacing: 1, textTransform: "uppercase" }}>
          {title}
        </span>
      )}
    </div>
  );
}

// Barra de progreso simple, reutilizada en Home y Progreso
function MacroBar({ label, value, target, color }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div style={{ flex: 1, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 10 }}>
      <div className="f-body" style={{ fontSize: 10.5, color: C.inkSoft, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ height: 5, background: C.paperSoft, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .3s ease" }} />
      </div>
      <div className="f-body" style={{ fontSize: 10, color: C.inkSoft, marginTop: 5 }}>
        {value}g / {target}g
      </div>
    </div>
  );
}

// ---------------- SCREENS ----------------

function ScreenWelcome({ next }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
      <div style={{ marginTop: 40 }}>
        <Circle />
        <h1 className="f-display" style={{ fontSize: 27, lineHeight: 1.25, color: C.ink, marginTop: 22, fontWeight: 500 }}>
          Bajar de peso no es
          <br />
          solo comer menos.
        </h1>
        <p className="f-body" style={{ fontSize: 14.5, color: C.inkSoft, marginTop: 10, lineHeight: 1.5 }}>
          Es entender por qué comés como comés.
          Vas a tener un plan hecho a tu medida
          y una persona real acompañándote.
        </p>
        <div style={{ marginTop: 16 }}>
          <Scribble />
        </div>
      </div>
      <PrimaryButton onClick={next}>Empezar</PrimaryButton>
    </div>
  );
}

function ScreenGoal({ next, prev, data, setData }) {
  const opts = ["Bajar de peso", "Mantenerme y ordenar mis hábitos", "Ganar masa muscular"];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Paso 1 de 4" onBack={prev} />
      <ProgressDots step={0} total={4} />
      <h2 className="f-display" style={{ fontSize: 21, color: C.ink, marginBottom: 20, fontWeight: 500 }}>
        ¿Qué te gustaría lograr?
      </h2>
      {opts.map((o) => (
        <OptionRow key={o} label={o} selected={data.goal === o} onClick={() => setData({ ...data, goal: o })} />
      ))}
      <div style={{ marginTop: "auto" }}>
        <PrimaryButton onClick={next} style={{ opacity: data.goal ? 1 : 0.4 }}>
          Continuar
        </PrimaryButton>
      </div>
    </div>
  );
}

function ScreenWeight({ next, prev, data, setData }) {
  const fields = [
    { label: "Peso actual (kg)", key: "currentWeight" },
    { label: "Peso deseado (kg)", key: "targetWeight" },
    { label: "Edad", key: "age" },
    { label: "Altura (cm)", key: "height" },
  ];
  const canContinue = data.currentWeight && data.targetWeight && data.age && data.height && data.sex;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Paso 2 de 4" onBack={prev} />
      <ProgressDots step={1} total={4} />
      <h2 className="f-display" style={{ fontSize: 21, color: C.ink, marginBottom: 6, fontWeight: 500 }}>
        Contános dónde estás
        <br />y a dónde querés llegar
      </h2>
      <p className="f-body" style={{ fontSize: 13, color: C.inkSoft, marginBottom: 22 }}>
        Con esto calculamos tus calorías y macros reales. Nunca lo compartimos.
      </p>
      <div style={{ overflowY: "auto", flex: 1 }}>
        <div
          className="almenta-4field-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}
        >
          {fields.map((f) => (
            <div key={f.key} style={{ minWidth: 0, marginBottom: 16 }}>
              <label className="f-body" style={{ fontSize: 12.5, color: C.inkSoft }}>
                {f.label}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={data[f.key] || ""}
                onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                className="f-body"
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "12px 10px",
                  borderRadius: 12,
                  border: `1.5px solid ${C.line}`,
                  fontSize: 14,
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}
        </div>

        <label className="f-body" style={{ fontSize: 12.5, color: C.inkSoft }}>
          Sexo biológico (para el cálculo calórico)
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {[
            { k: "F", l: "Mujer" },
            { k: "M", l: "Hombre" },
          ].map((s) => (
            <button
              key={s.k}
              onClick={() => setData({ ...data, sex: s.k })}
              className="f-body"
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: 12,
                border: `1.5px solid ${data.sex === s.k ? C.plum : C.line}`,
                background: data.sex === s.k ? C.sageSoft : "#fff",
                color: C.ink,
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              {s.l}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <PrimaryButton onClick={next} disabled={!canContinue} style={{ opacity: canContinue ? 1 : 0.4 }}>
          Continuar
        </PrimaryButton>
      </div>
    </div>
  );
}

function ScreenHistory({ next, prev, data, setData }) {
  const opts = [
    "Sí, varias veces, pero no lo sostuve",
    "Sí, una vez, y funcionó por un tiempo",
    "No, es la primera vez",
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Paso 3 de 4" onBack={prev} />
      <ProgressDots step={2} total={4} />
      <h2 className="f-display" style={{ fontSize: 21, color: C.ink, marginBottom: 20, fontWeight: 500 }}>
        ¿Intentaste bajar
        <br />
        de peso antes?
      </h2>
      {opts.map((o) => (
        <OptionRow key={o} label={o} selected={data.history === o} onClick={() => setData({ ...data, history: o })} />
      ))}
      <div style={{ marginTop: "auto" }}>
        <PrimaryButton onClick={next} style={{ opacity: data.history ? 1 : 0.4 }}>
          Continuar
        </PrimaryButton>
      </div>
    </div>
  );
}

function ScreenObstacle({ next, prev, data, setData }) {
  const opts = [
    "Se me hace difícil sostenerlo en el tiempo",
    "Como bien, pero después tengo un bajón y como de más",
    "No sé bien qué ni cuánto tengo que comer",
    "Me cuesta la actividad física",
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Paso 4 de 4" onBack={prev} />
      <ProgressDots step={3} total={4} />
      <h2 className="f-display" style={{ fontSize: 21, color: C.ink, marginBottom: 20, fontWeight: 500 }}>
        ¿Qué es lo que más
        <br />
        te frena normalmente?
      </h2>
      {opts.map((o) => (
        <OptionRow key={o} label={o} selected={data.obstacle === o} onClick={() => setData({ ...data, obstacle: o })} />
      ))}
      <div style={{ marginTop: "auto" }}>
        <PrimaryButton onClick={next} style={{ opacity: data.obstacle ? 1 : 0.4 }}>
          Continuar
        </PrimaryButton>
      </div>
    </div>
  );
}

function ScreenLoading({ next }) {
  const [i, setI] = useState(0);
  const msgs = ["Ajustando tus macros...", "Definiendo tu ritmo ideal...", "Preparando tu plan..."];
  React.useEffect(() => {
    if (i < msgs.length - 1) {
      const t = setTimeout(() => setI(i + 1), 700);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(next, 900);
      return () => clearTimeout(t);
    }
  }, [i]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center", justifyContent: "center" }}>
      <Circle size={56} />
      <p className="f-body" style={{ fontSize: 14.5, color: C.inkSoft, marginTop: 26, minHeight: 20 }}>
        {msgs[i]}
      </p>
      <div style={{ width: 140, height: 4, background: C.line, borderRadius: 4, marginTop: 18, overflow: "hidden" }}>
        <div
          style={{
            width: `${((i + 1) / msgs.length) * 100}%`,
            height: "100%",
            background: C.clay,
            transition: "width .6s ease",
          }}
        />
      </div>
    </div>
  );
}

function ScreenReveal({ next, data }) {
  const plan = useMemo(() => calcPlan(data), [data]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <p className="f-body" style={{ fontSize: 12, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 1 }}>
        Tu plan está listo
      </p>
      <h2 className="f-display" style={{ fontSize: 23, color: C.ink, margin: "10px 0 18px", fontWeight: 500 }}>
        Empezamos por acá
      </h2>
      <div style={{ background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span className="f-body" style={{ fontSize: 13, color: C.inkSoft }}>
            Calorías diarias
          </span>
          <span className="f-body" style={{ fontSize: 14, color: C.ink, fontWeight: 600 }}>
            ~{plan.kcal.toLocaleString("es-AR")} kcal
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { l: "Proteína", v: `${plan.protein}g`, c: C.plum },
            { l: "Carbos", v: `${plan.carbs}g`, c: C.sage },
            { l: "Grasas", v: `${plan.fat}g`, c: C.clay },
          ].map((m) => (
            <div key={m.l} style={{ flex: 1, background: C.paperSoft, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ width: 8, height: 8, borderRadius: 8, background: m.c, margin: "0 auto 6px" }} />
              <div className="f-body" style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                {m.v}
              </div>
              <div className="f-body" style={{ fontSize: 10.5, color: C.inkSoft }}>
                {m.l}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="f-body" style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.5, marginBottom: 10 }}>
        Tu objetivo:{" "}
        <span style={{ color: C.ink, fontWeight: 600 }}>{data.goal || "Bajar de peso"}</span>. Vamos a ajustar esto cada
        semana según cómo te vaya, no según lo planeado.
      </p>
      <div style={{ marginTop: "auto" }}>
        <PrimaryButton onClick={next}>Ver mi plan completo</PrimaryButton>
      </div>
    </div>
  );
}

function ScreenPaywall({ prev, goTo, data, setData, session, setSession }) {
  const [plan, setPlan] = useState("coach");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const rows = [
    ["Plan personalizado", true, true],
    ["Registro por foto y voz", true, true],
    ["Ajuste semanal automático", true, true],
    ["Infografías de bienestar", true, true],
    ["Coach real por WhatsApp", false, true],
    ["Asesoramiento de especialista en nutrición", false, true],
    ["Acompañamiento en días difíciles", false, true],
  ];

  // Flujo real al elegir un plan:
  // 1) Inicia sesión con Google (si no había sesión activa todavía).
  // 2) Guarda la sesión (perfil + respuestas del onboarding + plan elegido)
  //    en la hoja de cálculo vía Apps Script.
  // 3) Si es el plan pago: además registra el pedido y abre WhatsApp con el
  //    mensaje pre-cargado al número de almenta, para coordinar el pago por
  //    Mercado Pago manualmente. Si es el plan básico: va directo a Home.
  async function handleChoosePlan(planId) {
    setError(null);
    setBusy(true);
    try {
      let profile = session;
      if (!profile) {
        profile = await signInWithGoogle();
        storeSession(profile);
        setSession(profile);
      }

      const nextData = { ...data, plan: planId, profile };
      setData(nextData);

      await saveSession({ idToken: profile.idToken, plan: planId, data: nextData });

      if (planId === "coach") {
        await logPaidPlanRequest({
          idToken: profile.idToken,
          email: profile.email,
          name: profile.name,
        });
        openWhatsAppPaidPlanRequest({ name: profile.name, email: profile.email });
        goTo("checkout");
      } else {
        goTo("home");
      }
    } catch (err) {
      console.error(err);
      setError(
        "Algo falló al iniciar sesión o guardar tus datos. Probá de nuevo en un momento."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header onBack={prev} />
      <h2 className="f-display" style={{ fontSize: 21, color: C.ink, marginBottom: 4, fontWeight: 500 }}>
        Elegí cómo seguir
      </h2>
      <p className="f-body" style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16 }}>
        El plan Básico es gratis, para siempre.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { id: "basic", name: "Básico", price: "Gratis" },
          { id: "coach", name: "Con Coach", price: COACH_PLAN_PRICE },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPlan(p.id)}
            className="f-body"
            style={{
              flex: 1,
              padding: "12px 8px",
              borderRadius: 12,
              border: `1.5px solid ${plan === p.id ? C.plum : C.line}`,
              background: plan === p.id ? C.plumDeep : "#fff",
              color: plan === p.id ? "#fff" : C.ink,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 11.5, opacity: 0.85 }}>{p.price}</div>
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", flex: 1, overflowY: "auto" }}>
        {rows.map(([label, basic, coach]) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "9px 0",
              borderBottom: `1px solid ${C.paperSoft}`,
            }}
          >
            <span className="f-body" style={{ fontSize: 12.5, color: C.ink }}>
              {label}
            </span>
            <span style={{ fontSize: 14 }}>
              {(plan === "basic" ? basic : coach) ? (
                <Check size={16} color={C.sage} />
              ) : (
                <span style={{ color: C.line }}>—</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {plan === "coach" && (
        <p className="f-body" style={{ fontSize: 11, color: C.inkSoft, marginTop: 10 }}>
          Incluye el seguimiento de una especialista en nutrición y salud, no solo un chatbot.
        </p>
      )}

      {error && (
        <p className="f-body" style={{ fontSize: 11.5, color: C.roseDeep, marginTop: 8 }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: 14 }}>
        {plan === "basic" ? (
          <PrimaryButton
            onClick={() => handleChoosePlan("basic")}
            disabled={busy}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {busy ? <Loader2 size={16} className="spin" /> : <Mail size={16} />}
            {busy ? "Un momento…" : "Continuar con Google"}
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={() => handleChoosePlan("coach")}
            disabled={busy}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {busy && <Loader2 size={16} className="spin" />}
            {busy ? "Un momento…" : `Empezar con Coach — ${COACH_PLAN_PRICE}`}
          </PrimaryButton>
        )}
        <GhostButton onClick={() => (plan === "coach" ? handleChoosePlan("basic") : goTo("home"))}>
          {plan === "coach" ? "Ahora no, empezar con el plan gratis" : "Ahora no"}
        </GhostButton>
      </div>
    </div>
  );
}

// Pantalla de "handoff" a WhatsApp: se muestra justo después de abrir wa.me
// con el mensaje pre-cargado para el plan pago. El pago en sí lo coordina
// la persona con Vale por WhatsApp + Mercado Pago, no dentro de la app.
function ScreenCheckout({ goTo, session }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Casi listo" />
      <div style={{ marginTop: 30, textAlign: "center" }}>
        <div
          className="tab-panel-enter"
          style={{
            width: 76,
            height: 76,
            borderRadius: "50%",
            background: C.sageSoft,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          <IconHands color={C.plum} size={40} />
        </div>
        <h2 className="f-display" style={{ fontSize: 21, color: C.ink, fontWeight: 500, marginBottom: 8 }}>
          Te abrimos WhatsApp
        </h2>
        <p className="f-body" style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.5, padding: "0 8px" }}>
          Le avisamos a Vale que {session?.name?.split(" ")[0] || "vos"} querés el plan Con Coach.
          Si no se abrió solo, tocá el botón de abajo. Ahí coordinamos el pago por Mercado Pago
          y arrancamos.
        </p>
      </div>
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <PrimaryButton
          onClick={() => openWhatsAppPaidPlanRequest({ name: session?.name, email: session?.email })}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <MessageCircle size={16} /> Abrir WhatsApp de nuevo
        </PrimaryButton>
        <GhostButton onClick={() => goTo("home")}>Mientras tanto, ver mi plan</GhostButton>
      </div>
    </div>
  );
}

function ScreenHome({ data, setData, goTo, session, onLogout }) {
  const plan = useMemo(() => calcPlan(data), [data]);
  const totals = useMemo(() => todayTotals(data.foodLog), [data.foodLog]);
  const calorieSeries = useMemo(() => buildCalorieSeries(data.foodLog, plan), [data.foodLog, plan]);
  const activeDays = calorieSeries.filter((d) => d.kcal && d.kcal > 0).length;
  const kcalPct = plan.kcal > 0 ? Math.min(100, Math.round((totals.kcal / plan.kcal) * 100)) : 0;
  const firstName = session?.name?.split(" ")[0] || "de nuevo";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span className="f-body" style={{ fontSize: 12, color: C.inkSoft }}>
          Hola, {firstName}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: C.rose,
              padding: "5px 10px",
              borderRadius: 20,
            }}
          >
            <span style={{ fontSize: 13 }}>🔥</span>
            <span className="f-body" style={{ fontSize: 12.5, fontWeight: 600, color: C.roseDeep }}>
              {activeDays} / 7 días activa
            </span>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Cerrar sesión"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <LogOut size={16} color={C.inkSoft} />
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => goTo("logfood")}
        style={{
          background: C.plum,
          borderRadius: 18,
          border: "none",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          cursor: "pointer",
          marginBottom: 14,
        }}
      >
        <Camera size={20} color="#fff" />
        <span className="f-body" style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>
          Registrar comida
        </span>
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span className="f-body" style={{ fontSize: 12, color: C.inkSoft }}>
          Calorías de hoy
        </span>
        <span className="f-body" style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>
          {totals.kcal} / {plan.kcal} kcal
        </span>
      </div>
      <div style={{ height: 6, background: C.paperSoft, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
        <div
          style={{
            width: `${kcalPct}%`,
            height: "100%",
            background: kcalPct > 100 ? C.roseDeep : C.clay,
            transition: "width .3s ease",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <MacroBar label="Proteína" value={totals.protein} target={plan.protein} color={C.plum} />
        <MacroBar label="Carbos" value={totals.carbs} target={plan.carbs} color={C.sage} />
        <MacroBar label="Grasas" value={totals.fat} target={plan.fat} color={C.clay} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => goTo("progress")}
          className="f-body"
          style={{
            flex: 1,
            background: "none",
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: "10px 10px",
            fontSize: 12,
            color: C.ink,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Ver mi progreso →
        </button>
        <button
          onClick={() => goTo("bienestar")}
          className="f-body"
          style={{
            flex: 1,
            background: "none",
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: "10px 10px",
            fontSize: 12,
            color: C.ink,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Infografías de bienestar →
        </button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 }}>
        <p className="f-body" style={{ fontSize: 13, color: C.ink, marginBottom: 10, fontWeight: 500 }}>
          ¿Cómo estás hoy?
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {["🙂 Bien", "😐 Normal", "😔 Difícil"].map((m) => (
            <button
              key={m}
              onClick={m.includes("Difícil") ? () => goTo("difficult") : undefined}
              className="f-body"
              style={{
                flex: 1,
                padding: "9px 4px",
                borderRadius: 10,
                border: `1px solid ${C.line}`,
                background: C.paperSoft,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="f-body" style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 8 }}>
          Tocá "Difícil" para ver la pantalla de acompañamiento →
        </p>
      </div>
    </div>
  );
}

function ScreenLogFood({ data, setData, goTo }) {
  const [method, setMethod] = useState("texto");
  const [qty, setQty] = useState(1);
  const [custom, setCustom] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
  const [sessionEntries, setSessionEntries] = useState([]);
  const [feltMessage, setFeltMessage] = useState(null);

  const addFood = (food) => {
    const entry = {
      id: Date.now() + Math.random(),
      dayIndex: TODAY_IDX,
      name: food.name,
      kcal: Math.round(food.kcal * qty),
      protein: Math.round(food.protein * qty),
      carbs: Math.round(food.carbs * qty),
      fat: Math.round(food.fat * qty),
      tags: food.tags || [],
    };
    setData((d) => ({ ...d, foodLog: [...(d.foodLog || []), entry] }));
    setSessionEntries((s) => [...s, entry]);
    setFeltMessage(null);
    setQty(1);
  };

  const addCustom = () => {
    if (!custom.name || !custom.kcal) return;
    addFood({
      name: custom.name,
      kcal: parseFloat(custom.kcal) || 0,
      protein: parseFloat(custom.protein) || 0,
      carbs: parseFloat(custom.carbs) || 0,
      fat: parseFloat(custom.fat) || 0,
      tags: [],
    });
    setCustom({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
  };

  const reportFeeling = (symptom) => {
    if (symptom.negative) {
      setData((d) => ({ ...d, lastFeedback: { entries: sessionEntries, symptomKey: symptom.key } }));
      goTo("mealfeedback");
    } else {
      setFeltMessage(symptom.key === "liviana" ? "¡Qué bueno! Seguí así 🌿" : "¡Buenísimo, esa es la idea! ⚡");
    }
  };

  const todayCount = (data.foodLog || []).filter((f) => f.dayIndex === TODAY_IDX).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Registrar comida" onBack={() => goTo("home")} />

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { k: "foto", icon: Camera, l: "Foto" },
          { k: "voz", icon: Mic, l: "Voz" },
          { k: "texto", icon: Type, l: "Texto" },
        ].map(({ k, icon: Icon, l }) => (
          <button
            key={k}
            onClick={() => setMethod(k)}
            className="f-body almenta-tab"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 4px",
              borderRadius: 12,
              border: `1.5px solid ${method === k ? C.plum : C.line}`,
              background: method === k ? C.sageSoft : "#fff",
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            <Icon size={14} color={method === k ? C.plum : C.inkSoft} />
            {l}
          </button>
        ))}
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {method !== "texto" ? (
          <div style={{ textAlign: "center", padding: "36px 16px", background: C.paperSoft, borderRadius: 14 }}>
            <p className="f-body" style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
              Simulación: en la app real acá {method === "foto" ? "se analiza la foto con IA" : "se transcribe tu audio"}{" "}
              para estimar los macros automáticamente.
            </p>
            <PrimaryButton onClick={() => setMethod("texto")}>Probar con texto</PrimaryButton>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span className="f-body" style={{ fontSize: 12, color: C.inkSoft }}>
                Cantidad
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                {[0.5, 1, 1.5, 2].map((q) => (
                  <button
                    key={q}
                    onClick={() => setQty(q)}
                    className="f-body"
                    style={{
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: `1px solid ${qty === q ? C.plum : C.line}`,
                      background: qty === q ? C.plum : "#fff",
                      color: qty === q ? "#fff" : C.ink,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    x{q}
                  </button>
                ))}
              </div>
            </div>

            {QUICK_FOODS.map((f, i) => (
              <button
                key={f.name}
                onClick={() => addFood(f)}
                className="f-body almenta-btn list-item-enter"
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "left",
                  padding: "12px 14px",
                  marginBottom: 8,
                  borderRadius: 12,
                  border: `1px solid ${C.line}`,
                  background: "#fff",
                  cursor: "pointer",
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, color: C.ink }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                    {Math.round(f.kcal * qty)} kcal · P{Math.round(f.protein * qty)} C{Math.round(f.carbs * qty)} G
                    {Math.round(f.fat * qty)}
                  </div>
                </div>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: C.sageSoft,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Plus size={15} color={C.sage} />
                </div>
              </button>
            ))}

            <details
              className="f-body"
              style={{
                marginTop: 14,
                border: `1px solid ${C.line}`,
                borderRadius: 12,
                background: "#fff",
                overflow: "hidden",
              }}
            >
              <summary
                style={{
                  padding: "12px 14px",
                  fontSize: 12.5,
                  color: C.ink,
                  fontWeight: 500,
                  cursor: "pointer",
                  listStyle: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                o cargá un plato manual
                <span style={{ color: C.inkSoft, fontSize: 11 }}>tocá para abrir ▾</span>
              </summary>
              <div className="tab-panel-enter" style={{ padding: "4px 14px 14px" }}>
                <input
                  placeholder="Nombre del plato"
                  value={custom.name}
                  onChange={(e) => setCustom({ ...custom, name: e.target.value })}
                  className="f-body"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1.5px solid ${C.line}`,
                    fontSize: 13,
                    marginBottom: 8,
                    boxSizing: "border-box",
                  }}
                />
                <div
                  className="almenta-4field-grid"
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}
                >
                  {[
                    { k: "kcal", l: "kcal" },
                    { k: "protein", l: "prot g" },
                    { k: "carbs", l: "carb g" },
                    { k: "fat", l: "grasa g" },
                  ].map((f) => (
                    <input
                      key={f.k}
                      type="number"
                      inputMode="decimal"
                      placeholder={f.l}
                      value={custom[f.k]}
                      onChange={(e) => setCustom({ ...custom, [f.k]: e.target.value })}
                      className="f-body"
                      style={{
                        width: "100%",
                        minWidth: 0,
                        padding: "10px 6px",
                        borderRadius: 10,
                        border: `1.5px solid ${C.line}`,
                        fontSize: 12,
                        textAlign: "center",
                        boxSizing: "border-box",
                      }}
                    />
                  ))}
                </div>
                <GhostButton onClick={addCustom}>+ Agregar plato manual</GhostButton>
              </div>
            </details>
          </>
        )}
      </div>

      {sessionEntries.length > 0 && (
        <div style={{ background: C.paperSoft, borderRadius: 14, padding: 14, marginTop: 12 }}>
          <p className="f-body" style={{ fontSize: 12.5, color: C.ink, fontWeight: 500, marginBottom: 10 }}>
            ¿Cómo te sentiste con esto?
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SYMPTOMS.map((s) => (
              <button
                key={s.key}
                onClick={() => reportFeeling(s)}
                className="f-body"
                style={{
                  padding: "7px 10px",
                  borderRadius: 20,
                  border: `1px solid ${C.line}`,
                  background: "#fff",
                  fontSize: 11.5,
                  cursor: "pointer",
                }}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
          {feltMessage && (
            <p className="f-body" style={{ fontSize: 12, color: C.sage, marginTop: 10 }}>
              {feltMessage}
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <p className="f-body" style={{ fontSize: 11.5, color: C.inkSoft, marginBottom: 8, textAlign: "center" }}>
          {todayCount} {todayCount === 1 ? "comida registrada" : "comidas registradas"} hoy
        </p>
        <PrimaryButton onClick={() => goTo("home")}>Listo, volver a inicio</PrimaryButton>
      </div>
    </div>
  );
}

function ScreenMealFeedback({ data, setData, goTo }) {
  const feedback = data.lastFeedback;
  const symptom = SYMPTOMS.find((s) => s.key === (feedback && feedback.symptomKey));
  const TissueIcon =
    symptom && symptom.tissue === "gut" ? IconGut : symptom && symptom.tissue === "energia" ? IconSpark : IconDrop;

  const suggestions = symptom ? suggestionsFor(symptom.tissue) : [];

  const addSuggestion = (food) => {
    const entry = {
      id: Date.now() + Math.random(),
      dayIndex: TODAY_IDX,
      name: food.name,
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      tags: ["sugerido"],
    };
    setData((d) => ({ ...d, foodLog: [...(d.foodLog || []), entry] }));
  };

  if (!feedback || !symptom) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Header onBack={() => goTo("home")} />
        <p className="f-body" style={{ fontSize: 13.5, color: C.inkSoft }}>
          Todavía no hay una sensación registrada para analizar.
        </p>
        <div style={{ marginTop: "auto" }}>
          <PrimaryButton onClick={() => goTo("home")}>Volver a inicio</PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Cómo te sentiste" onBack={() => goTo("home")} />

      <div style={{ overflowY: "auto", flex: 1 }}>
        <div style={{ background: C.rose, borderRadius: 16, padding: 18, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <TissueIcon color={C.plumDeep} size={38} />
          <p className="f-display" style={{ fontSize: 14.5, color: C.plumDeep, lineHeight: 1.45, fontWeight: 500, margin: 0 }}>
            {symptom.explanation}
          </p>
        </div>

        <p className="f-body" style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, marginBottom: 8 }}>
          Lo que registraste
        </p>
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "6px 14px", marginBottom: 16 }}>
          {feedback.entries.map((f, i) => {
            const isCulprit = (f.tags || []).some((t) => symptom.culpritTags.includes(t));
            return (
              <div
                key={f.id || i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: i < feedback.entries.length - 1 ? `1px solid ${C.paperSoft}` : "none",
                }}
              >
                <span
                  className="f-body"
                  style={{
                    fontSize: 13.5,
                    color: isCulprit ? C.inkSoft : C.ink,
                    textDecoration: isCulprit ? "line-through" : "none",
                  }}
                >
                  {f.name}
                </span>
                {isCulprit && (
                  <span className="f-body" style={{ fontSize: 10.5, color: C.roseDeep }}>
                    esto pesó
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p className="f-body" style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, marginBottom: 8 }}>
          Para la próxima, sumá
        </p>
        {suggestions.map((s) => (
          <div
            key={s.name}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: C.sageSoft,
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Plus size={14} color={C.sage} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="f-body" style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>
                {s.name}
              </div>
              <div className="f-body" style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>
                {s.benefit}
              </div>
              <button
                onClick={() => addSuggestion(s)}
                className="f-body"
                style={{
                  marginTop: 6,
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: 11.5,
                  color: C.plum,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Sumarlo a hoy
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <PrimaryButton onClick={() => goTo("home")}>Volver a inicio</PrimaryButton>
      </div>
    </div>
  );
}

function ScreenBienestar({ goTo }) {
  const [active, setActive] = useState(TISSUE_CARDS[0].key);
  const card = TISSUE_CARDS.find((c) => c.key === active) || TISSUE_CARDS[0];
  const CardIcon = TISSUE_ICONS[card.icon];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Bienestar" onBack={() => goTo("home")} />
      <h2 className="f-display" style={{ fontSize: 20, color: C.ink, marginBottom: 4, fontWeight: 500 }}>
        Lo que comés, se nota acá
      </h2>
      <p className="f-body" style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 16 }}>
        Un poco de fisiología, en criollo. Tocá cada zona para ver cómo la cuidás.
      </p>

      {/* Tabs: una por tejido/función, en vez de la lista larga */}
      <div
        className="almenta-3col"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}
      >
        {TISSUE_CARDS.map((c) => {
          const TabIcon = TISSUE_ICONS[c.icon];
          const isActive = c.key === active;
          return (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className="f-body almenta-tab"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "10px 4px",
                borderRadius: 12,
                border: `1.5px solid ${isActive ? c.color : C.line}`,
                background: isActive ? C.paperSoft : "#fff",
                cursor: "pointer",
                minWidth: 0,
              }}
            >
              <TabIcon color={c.color} size={22} />
              <span
                style={{
                  fontSize: 10.5,
                  color: isActive ? C.ink : C.inkSoft,
                  fontWeight: isActive ? 600 : 400,
                  textAlign: "center",
                  lineHeight: 1.15,
                }}
              >
                {c.title}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        <div
          key={active}
          className="tab-panel-enter"
          style={{
            background: "#fff",
            border: `1px solid ${C.line}`,
            borderRadius: 16,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 12,
          }}
        >
          <CardIcon color={card.color} size={56} />
          <p className="f-display" style={{ fontSize: 17, color: C.ink, fontWeight: 500, margin: 0 }}>
            {card.title}
          </p>
          <Scribble color={card.color} width={90} />
          <p className="f-body" style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.55, margin: 0 }}>
            {card.text}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <GhostButton onClick={() => goTo("guia")}>Ver tabla comparativa de grasas, proteínas y carbohidratos</GhostButton>
        <PrimaryButton onClick={() => goTo("home")}>Volver a inicio</PrimaryButton>
      </div>
    </div>
  );
}

function ScreenGuia({ goTo }) {
  const [cat, setCat] = useState("fats");
  const [side, setSide] = useState("colA"); // sub-tab: qué columna mostrar
  const guide = FOOD_GUIDE[cat];
  const col = guide[side];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Guía de alimentos" onBack={() => goTo("bienestar")} />
      <h2 className="f-display" style={{ fontSize: 19, color: C.ink, marginBottom: 4, fontWeight: 500 }}>
        Tabla comparativa
      </h2>
      <p className="f-body" style={{ fontSize: 12, color: C.inkSoft, marginBottom: 14 }}>
        En proteínas no hay "mejor y peor": son dos fuentes distintas, no un ranking.
      </p>

      {/* Tab principal: categoría de alimento */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {Object.entries(FOOD_GUIDE).map(([key, g]) => (
          <button
            key={key}
            onClick={() => {
              setCat(key);
              setSide("colA");
            }}
            className="f-body almenta-tab"
            style={{
              flex: 1,
              padding: "9px 4px",
              borderRadius: 10,
              border: `1.5px solid ${cat === key ? C.plum : C.line}`,
              background: cat === key ? C.sageSoft : "#fff",
              fontSize: 12,
              fontWeight: cat === key ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {g.title}
          </button>
        ))}
      </div>

      {/* Sub-tab: qué columna (ej. Saludables / Para moderar) — una lista a la vez */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          background: C.paperSoft,
          borderRadius: 12,
          marginBottom: 14,
        }}
      >
        {["colA", "colB"].map((s) => {
          const c = guide[s];
          const isActive = side === s;
          return (
            <button
              key={s}
              onClick={() => setSide(s)}
              className="f-body almenta-tab"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "9px 6px",
                borderRadius: 9,
                border: "none",
                background: isActive ? "#fff" : "transparent",
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: C.ink,
                cursor: "pointer",
                minWidth: 0,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 8, background: c.color, flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div
          key={cat + side}
          className="tab-panel-enter"
          style={{
            background: "#fff",
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            padding: 16,
          }}
        >
          {col.items.map((item, i) => (
            <div
              key={item}
              className="list-item-enter"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "8px 0",
                borderBottom: i < col.items.length - 1 ? `1px solid ${C.paperSoft}` : "none",
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 6, background: col.color, flexShrink: 0, marginTop: 6 }} />
              <p className="f-body" style={{ fontSize: 13, color: C.ink, lineHeight: 1.5, margin: 0 }}>
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <PrimaryButton onClick={() => goTo("bienestar")}>Volver a infografías</PrimaryButton>
      </div>
    </div>
  );
}

function ScreenProgress({ data, goTo }) {
  const plan = useMemo(() => calcPlan(data), [data]);
  const weightSeries = useMemo(() => buildWeightSeries(data), [data]);
  const calorieSeries = useMemo(() => buildCalorieSeries(data.foodLog, plan), [data.foodLog, plan]);
  const totals = useMemo(() => todayTotals(data.foodLog), [data.foodLog]);

  const macroData = [
    { name: "Proteína", value: totals.protein * 4, color: C.plum },
    { name: "Carbos", value: totals.carbs * 4, color: C.sage },
    { name: "Grasas", value: totals.fat * 9, color: C.clay },
  ].filter((m) => m.value > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Tu progreso" onBack={() => goTo("home")} />

      <div style={{ overflowY: "auto", flex: 1 }}>
        <p className="f-body" style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, marginBottom: 4 }}>
          Peso
        </p>
        <p className="f-body" style={{ fontSize: 10.5, color: C.inkSoft, marginBottom: 6 }}>
          Línea sólida: peso real cargado. Punteada: tu meta ({data.targetWeight || "—"} kg).
        </p>
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 6px 4px", marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={weightSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.line} vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.inkSoft }} axisLine={false} tickLine={false} />
              <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
              <Line type="monotone" dataKey="target" stroke={C.sage} strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="weight" stroke={C.plum} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="f-body" style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, marginBottom: 4 }}>
          Calorías vs. objetivo
        </p>
        <p className="f-body" style={{ fontSize: 10.5, color: C.inkSoft, marginBottom: 6 }}>
          Línea punteada: tu objetivo diario (~{plan.kcal.toLocaleString("es-AR")} kcal).
        </p>
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 6px 4px", marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart data={calorieSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.line} vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.inkSoft }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, "dataMax + 200"]} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} />
              <ReferenceLine y={plan.kcal} stroke={C.clay} strokeDasharray="4 4" />
              <Bar dataKey="kcal" radius={[4, 4, 0, 0]}>
                {calorieSeries.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.kcal == null
                        ? "transparent"
                        : entry.kcal > plan.kcal * 1.15
                        ? C.roseDeep
                        : entry.kcal < plan.kcal * 0.8
                        ? C.sageSoft
                        : C.plum
                    }
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="f-body" style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, marginBottom: 8 }}>
          Macros de hoy
        </p>
        <div
          style={{
            background: "#fff",
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            padding: 12,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={macroData.length ? macroData : [{ name: "Sin registros", value: 1, color: C.line }]}
                  dataKey="value"
                  innerRadius={30}
                  outerRadius={46}
                  paddingAngle={2}
                >
                  {(macroData.length ? macroData : [{ color: C.line }]).map((m, i) => (
                    <Cell key={i} fill={m.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
              }}
            >
              <div className="f-body" style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                {totals.kcal}
              </div>
              <div className="f-body" style={{ fontSize: 9, color: C.inkSoft }}>
                kcal hoy
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {[
              { l: "Proteína", v: totals.protein, t: plan.protein, c: C.plum },
              { l: "Carbos", v: totals.carbs, t: plan.carbs, c: C.sage },
              { l: "Grasas", v: totals.fat, t: plan.fat, c: C.clay },
            ].map((m) => (
              <div key={m.l} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: 7, background: m.c, flexShrink: 0 }} />
                <span className="f-body" style={{ fontSize: 11.5, color: C.ink }}>
                  {m.l}: {m.v}g / {m.t}g
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="f-body" style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, marginBottom: 8 }}>
          Historial de la semana
        </p>
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "4px 14px", marginBottom: 8 }}>
          {calorieSeries.map((d, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: i < calorieSeries.length - 1 ? `1px solid ${C.paperSoft}` : "none",
              }}
            >
              <span className="f-body" style={{ fontSize: 12, color: C.ink, width: 60 }}>
                {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i]}
                {i === TODAY_IDX ? " (hoy)" : ""}
              </span>
              <span className="f-body" style={{ fontSize: 12, color: C.inkSoft }}>
                {d.kcal == null ? "—" : `${d.kcal} kcal`}
              </span>
              <span style={{ width: 18, textAlign: "center" }}>
                {d.kcal == null ? null : Math.abs(d.kcal - plan.kcal) <= plan.kcal * 0.15 ? (
                  <Check size={14} color={C.sage} />
                ) : (
                  <span style={{ color: C.roseDeep, fontSize: 13 }}>•</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <PrimaryButton onClick={() => goTo("home")}>Volver a inicio</PrimaryButton>
      </div>
    </div>
  );
}

function ScreenDifficultDay({ goTo }) {
  const [chose, setChose] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header onBack={() => goTo("home")} />
      <div style={{ background: C.rose, borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <IconHeart color={C.plumDeep} size={36} />
        <p className="f-display" style={{ fontSize: 17, color: C.plumDeep, lineHeight: 1.4, fontWeight: 500, marginTop: 12 }}>
          Gracias por contarlo.
          <br />A veces los días pesan
          <br />
          más que otros.
        </p>
      </div>

      {!chose ? (
        <>
          <OptionRow label="Quiero escribirle a mi coach" onClick={() => setChose("coach")} />
          <OptionRow label="Solo necesitaba decirlo, seguimos mañana" onClick={() => setChose("later")} />
        </>
      ) : chose === "coach" ? (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <MessageCircle size={18} color={C.sage} />
            <span className="f-body" style={{ fontSize: 12.5, color: C.inkSoft }}>
              Chat con Vale, tu coach
            </span>
          </div>
          <div style={{ background: C.paperSoft, borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <p className="f-body" style={{ fontSize: 13, color: C.ink }}>
              Hola Vale, hoy fue un día difícil con la comida y quería contarlo.
            </p>
          </div>
          <p className="f-body" style={{ fontSize: 11.5, color: C.inkSoft }}>
            Te respondemos en menos de 4 horas hábiles.
          </p>
        </div>
      ) : (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, textAlign: "center" }}>
          <p className="f-body" style={{ fontSize: 13.5, color: C.ink }}>
            Está bien. Un día no define tu semana.
            <br />
            Seguimos mañana. 🌱
          </p>
        </div>
      )}

      <div style={{ marginTop: "auto" }}>
        <PrimaryButton onClick={() => goTo("weekly")}>Ver resumen semanal</PrimaryButton>
      </div>
    </div>
  );
}

function ScreenWeekly({ data, goTo, restart }) {
  const plan = useMemo(() => calcPlan(data), [data]);
  const calorieSeries = useMemo(() => buildCalorieSeries(data.foodLog, plan), [data.foodLog, plan]);
  const activeDays = calorieSeries.filter((d) => d.kcal && d.kcal > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Tu semana" onBack={() => goTo("home")} />
      <h2 className="f-display" style={{ fontSize: 20, color: C.ink, marginBottom: 16, fontWeight: 500 }}>
        Vas bien, Julia
      </h2>
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span className="f-body" style={{ fontSize: 12.5, color: C.inkSoft }}>
            Días activa
          </span>
          <span className="f-body" style={{ fontSize: 13, fontWeight: 600 }}>
            {activeDays} / 7
          </span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {DAYS.map((d, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "8px 0",
                borderRadius: 8,
                background: i === TODAY_IDX ? C.rose : calorieSeries[i].kcal ? C.sageSoft : C.paperSoft,
                fontSize: 11,
                color: C.ink,
              }}
              className="f-body"
            >
              {d}
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: C.paperSoft, borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <MessageCircle size={16} color={C.plum} />
          <span className="f-body" style={{ fontSize: 12, color: C.inkSoft }}>
            Mensaje de Vale
          </span>
        </div>
        <p className="f-body" style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>
          "Vi tu progreso, vas bien. Esta semana tuviste un día difícil y volviste — eso también es progreso.
          ¿Cómo te sentís vos con esto?"
        </p>
      </div>
      <div style={{ marginTop: "auto" }}>
        <PrimaryButton onClick={restart}>Volver al inicio del recorrido</PrimaryButton>
      </div>
    </div>
  );
}

// ---------------- APP SHELL ----------------

const SCREEN_NAMES = [
  "welcome",
  "goal",
  "weight",
  "history",
  "obstacle",
  "loading",
  "reveal",
  "paywall",
  "checkout",
  "home",
  "logfood",
  "mealfeedback",
  "progress",
  "bienestar",
  "guia",
  "difficult",
  "weekly",
];

const SCREENS = [
  ScreenWelcome,
  ScreenGoal,
  ScreenWeight,
  ScreenHistory,
  ScreenObstacle,
  ScreenLoading,
  ScreenReveal,
  ScreenPaywall,
  ScreenCheckout,
  ScreenHome,
  ScreenLogFood,
  ScreenMealFeedback,
  ScreenProgress,
  ScreenBienestar,
  ScreenGuia,
  ScreenDifficultDay,
  ScreenWeekly,
];

const IDX = Object.fromEntries(SCREEN_NAMES.map((n, i) => [n, i]));

// Screens que ya requieren que la persona haya elegido un plan (para no
// perder el trabajo si vuelve a abrir la app habiendo iniciado sesión antes).
const POST_ONBOARDING_SCREEN = "home";

export default function App() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({});
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);

  const next = () => setStep((s) => Math.min(s + 1, SCREENS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));
  const restart = () => setStep(0);
  const goTo = (name) => setStep(IDX[name] ?? 0);

  // Al abrir la app (o al instalarla como PWA y reabrirla), si ya había una
  // sesión de Google guardada, la restauramos junto con los datos que estén
  // en Sheets, para no hacerle repetir el onboarding a alguien que ya es usuaria.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getStoredSession();
      if (!stored) {
        setRestoring(false);
        return;
      }
      try {
        const remoteData = await loadSession({ idToken: stored.idToken });
        if (cancelled) return;
        setSession(stored);
        if (remoteData) {
          setData(remoteData);
          goTo(POST_ONBOARDING_SCREEN);
        }
      } catch (err) {
        // Si el token venció o Sheets no responde, seguimos como usuaria nueva
        // en vez de trabar la app.
        console.warn("No se pudo restaurar la sesión:", err);
        clearStoredSession();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoguardado: cada vez que cambian los datos de una persona con sesión
  // iniciada (por ejemplo, registró una comida), lo reflejamos en Sheets con
  // un pequeño debounce para no disparar un request por cada tecla.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!session || restoring) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSession({ idToken: session.idToken, plan: data.plan, data }).catch((err) =>
        console.warn("No se pudo autoguardar en Sheets:", err)
      );
    }, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [data, session, restoring]);

  function handleLogout() {
    clearStoredSession();
    setSession(null);
    setData({});
    restart();
  }

  const Screen = SCREENS[step];

  if (restoring) {
    return (
      <div
        className="f-body"
        style={{
          minHeight: "100vh",
          background: C.paperSoft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <style>{FONTS}</style>
        <Loader2 size={22} color={C.plum} className="spin" />
      </div>
    );
  }

  return (
    <div
      className="f-body"
      style={{
        minHeight: "100vh",
        background: C.paper,
        display: "flex",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <style>{FONTS}</style>
      <div
        className="almenta-shell"
        style={{
          width: "100%",
          maxWidth: 480,
          minHeight: "100vh",
          padding: "24px 20px calc(20px + env(safe-area-inset-bottom))",
          boxSizing: "border-box",
          overflowX: "hidden",
        }}
      >
        <div key={step} className="screen-enter" style={{ height: "100%" }}>
          <Screen
            next={next}
            prev={prev}
            restart={restart}
            goTo={goTo}
            data={data}
            setData={setData}
            session={session}
            setSession={setSession}
            onLogout={handleLogout}
          />
        </div>
      </div>
    </div>
  );
}
