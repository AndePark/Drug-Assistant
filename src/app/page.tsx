"use client";

import { FormEvent, useMemo, useState } from "react";
import { getRecommendations, type Recommendation } from "@/lib/recommendations";

function ResultCard({
  rank,
  recommendation,
}: {
  rank: number;
  recommendation: Recommendation;
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white">
          {rank}
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {recommendation.brandName}
          </h3>
          <p className="text-sm text-slate-500">
            Active ingredient: {recommendation.genericName}
          </p>
          <p className="mt-1 text-sm text-slate-600">{recommendation.description}</p>
          <p className="mt-2 text-xs text-slate-500">
            Helps with: {recommendation.matchedSymptoms.join(", ")}
          </p>
        </div>
      </div>
    </li>
  );
}

export default function Home() {
  const [symptoms, setSymptoms] = useState("headache, fever");
  const [exceptions, setExceptions] = useState("allergic to ibuprofen");
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => {
    if (!submitted) return null;
    return getRecommendations(symptoms, exceptions);
  }, [submitted, symptoms, exceptions]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          OTC only · Rule-based · Informational
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Symptom Relief Assistant
        </h1>
        <p className="mt-3 text-slate-600">
          Enter your symptoms and any allergies or health exceptions. Each
          suggestion is matched to what you entered—not a fixed list for every
          user.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="symptoms"
            className="mb-1.5 block text-sm font-medium text-slate-800"
          >
            Symptoms
          </label>
          <textarea
            id="symptoms"
            value={symptoms}
            onChange={(e) => {
              setSubmitted(false);
              setSymptoms(e.target.value);
            }}
            rows={3}
            placeholder="e.g. headache, fever, upset stomach — any wording works"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-teal-500 focus:ring-2"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            List anything you feel — comma or line separated. Recommendations are
            scored against each symptom you enter.
          </p>
        </div>

        <div>
          <label
            htmlFor="exceptions"
            className="mb-1.5 block text-sm font-medium text-slate-800"
          >
            Allergies &amp; exceptions
          </label>
          <textarea
            id="exceptions"
            value={exceptions}
            onChange={(e) => {
              setSubmitted(false);
              setExceptions(e.target.value);
            }}
            rows={3}
            placeholder="e.g. allergic to ibuprofen, high blood pressure"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-teal-500 focus:ring-2"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Use drug or brand names (Tylenol, Advil) or conditions (high blood
            pressure, pregnancy).
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-teal-600 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-700 sm:w-auto"
        >
          Get recommendations
        </button>
      </form>

      {submitted && result && (
        <section className="mt-10" aria-live="polite">
          <h2 className="text-xl font-semibold text-slate-900">
            Top {result.recommendations.length || 0} suggestions
          </h2>

          {result.recommendations.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {result.recommendations.map((rec, index) => (
                <ResultCard key={rec.id} rank={index + 1} recommendation={rec} />
              ))}
            </ol>
          ) : (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No OTC matches found for your symptoms after applying your exceptions.
              Try rephrasing symptoms (e.g. &quot;stomach pain&quot;, &quot;dry cough&quot;) or
              review your allergy list.
            </p>
          )}

          {result.symptomMappings.length > 0 && (
            <p className="mt-4 text-sm text-slate-600">
              Interpreted your wording as:{" "}
              <span className="font-medium text-slate-800">
                {result.symptomMappings
                  .map((m) => `"${m.from}" → ${m.to}`)
                  .join("; ")}
              </span>
            </p>
          )}

          {result.unmatchedSymptoms.length > 0 && (
            <p className="mt-4 text-sm text-amber-800">
              Could not match even to a close symptom:{" "}
              <span className="font-medium">
                {result.unmatchedSymptoms.join(", ")}
              </span>
              . Try terms like pain, cough, nausea, or congestion.
            </p>
          )}

          <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
            <strong className="text-slate-800">Disclaimer:</strong> This tool is for
            general information only. It does not diagnose conditions or replace
            advice from a pharmacist or doctor. Brand names are examples; many
            store brands contain the same active ingredients. Always read product
            labels and ask a professional if you are unsure.
          </p>
        </section>
      )}
    </main>
  );
}
