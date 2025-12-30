"use client";

import { useEffect, useMemo, useState } from "react";

type Stage = "welcome" | "memorize" | "recall" | "result";
type Performance = "fail" | "good" | "better" | "excellent";

const TEST_DURATION = 60;
const TARGET_COUNT = 15;
const DISPLAY_COUNT = 20;

const STATUS_RULES: { label: Performance; threshold: number; copy: string }[] = [
  {
    label: "excellent",
    threshold: 20,
    copy: "Elite recall. You nailed the full target set.",
  },
  {
    label: "better",
    threshold: 15,
    copy: "Strong performance. Keep sharpening that focus.",
  },
  {
    label: "good",
    threshold: 10,
    copy: "Solid baseline. Another run can push you higher.",
  },
  {
    label: "fail",
    threshold: 0,
    copy: "Warm up again and give it another go.",
  },
];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ResultPayload = {
  email: string;
  namesPresented: string[];
  answersSubmitted: string[];
  score: number;
  status: Performance;
};

const STAGE_DETAILS: Record<Stage, { title: string; subtitle: string }> = {
  welcome: {
    title: "Word Recall Sprint",
    subtitle:
      "Welcome to this word recall test. You will see 20 words. You will then be asked to recall as many of those words as you can. Please enter your email to begin.",
  },
  memorize: {
    title: `Memorize ${DISPLAY_COUNT} Names`,
    subtitle: "You have 60 seconds. Capture as many as you can.",
  },
  recall: {
    title: "Recall Phase",
    subtitle:
      "Type the names you remember, separated by commas or spaces. Order does not matter.",
  },
  result: {
    title: "Scoreboard",
    subtitle: "Nicely done. Results auto-reset so you can run it again.",
  },
};

const NAV_LINKS = ["Home", "Shop", "About us", "Science", "Event", "FAQ", "Contact Us"];

const HERO_POINTS = [
  "Achieve higher ELO — naturally.",
  "Fuel focus with smooth, sustained mental energy.",
  "1700 mg of active ingredients per serving.",
  "No caffeine. No crash. Just clarity that lasts.",
];

const getStatusDetails = (value: number) =>
  STATUS_RULES.find((rule) => value >= rule.threshold) ?? STATUS_RULES.at(-1)!;

const normalize = (value: string) => value.trim().toLowerCase();

const parseAnswers = (input: string) => {
  const parts = input
    .split(/[\s,\n]+/)
    .map((piece) => normalize(piece))
    .filter(Boolean);
  return Array.from(new Set(parts));
};

export default function Home() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [email, setEmail] = useState("");
  const [timer, setTimer] = useState(TEST_DURATION);
  const [names, setNames] = useState<string[]>([]);
  const [recallInput, setRecallInput] = useState("");
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<Performance>("fail");
  const [error, setError] = useState("");
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [isFetchingNames, setIsFetchingNames] = useState(false);
  const [isCalculatingResult, setIsCalculatingResult] = useState(false);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [persistenceError, setPersistenceError] = useState("");
  const [correctWords, setCorrectWords] = useState<string[]>([]);
  const [incorrectWords, setIncorrectWords] = useState<string[]>([]);
  const [missedWords, setMissedWords] = useState<string[]>([]);

  const parsedAnswers = useMemo(() => parseAnswers(recallInput), [recallInput]);

  useEffect(() => {
    if (stage !== "memorize") {
      return;
    }
    setTimer(TEST_DURATION);
    const interval = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setStage("recall");
          return TEST_DURATION;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (stage !== "result") {
      return;
    }
    const timeout = window.setTimeout(() => {
      window.location.href =
        "https://mentalathlete.gg/products/pulse-nootropic?selling_plan=692626391342&variant=50538101702958";
    }, 10000);
    return () => window.clearTimeout(timeout);
  }, [stage]);

  const startTest = async () => {
    if (!EMAIL_REGEX.test(email)) {
      setError("Enter a valid email to continue.");
      return;
    }
    setError("");
    setPersistenceError("");
    setIsFetchingNames(true);
    try {
      const [response] = await Promise.all([
        fetch("/api/names"),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload: { names?: string[]; poolSize?: number } = await response.json();
      const pulledNames = payload.names ?? [];
      if (pulledNames.length < DISPLAY_COUNT) {
        throw new Error("Not enough names returned from Supabase.");
      }
      setNames(pulledNames);
      setPoolSize(payload.poolSize ?? pulledNames.length);
      setRecallInput("");
      setStage("memorize");
    } catch (fetchError) {
      console.error("Failed to fetch names", fetchError);
      setError("Unable to load names right now. Please try again in a moment.");
    } finally {
      setIsFetchingNames(false);
    }
  };

  const handleRecallSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parsedAnswers.length) {
      setError("Add at least one name before submitting.");
      return;
    }

    setIsCalculatingResult(true);
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const reference = new Map(names.map((name) => [normalize(name), name]));
    const nextCorrect: string[] = [];
    const nextIncorrect: string[] = [];

    parsedAnswers.forEach((answer) => {
      const original = reference.get(answer);
      if (original && !nextCorrect.includes(original)) {
        nextCorrect.push(original);
      } else if (!original) {
        nextIncorrect.push(answer);
      }
    });

    const nextMissed = names.filter((name) => !nextCorrect.includes(name));
    const hits = nextCorrect.length;
    const outcome = getStatusDetails(hits);
    const payload: ResultPayload = {
      email,
      namesPresented: names,
      answersSubmitted: parsedAnswers,
      score: hits,
      status: outcome.label,
    };
    setScore(hits);
    setStatus(outcome.label);
    setCorrectWords(nextCorrect);
    setIncorrectWords(nextIncorrect);
    setMissedWords(nextMissed);
    setError("");
    setIsCalculatingResult(false);
    setStage("result");
    void persistResult(payload);
  };

  const persistResult = async (payload: ResultPayload) => {
    if (!payload.email) {
      return;
    }
    setIsSavingResult(true);
    setPersistenceError("");
    try {
      const response = await fetch("/api/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
    } catch (persistError) {
      console.error("Failed to save result", persistError);
      setPersistenceError(
        "Could not sync this run to Supabase. Your score is still shown locally."
      );
    } finally {
      setIsSavingResult(false);
    }
  };

  const skipMemorize = () => setStage("recall");

  const resetTest = () => {
    setStage("welcome");
    setNames([]);
    setRecallInput("");
    setTimer(TEST_DURATION);
    setScore(0);
    setStatus("fail");
    setEmail("");
    setError("");
    setPersistenceError("");
    setCorrectWords([]);
    setIncorrectWords([]);
    setMissedWords([]);
  };

  const stageCopy = STAGE_DETAILS[stage];
  const progress = stage === "memorize" ? (timer / TEST_DURATION) * 100 : 0;
  const statusCopy = getStatusDetails(score);

  return (
    <div className="min-h-screen bg-[#faf5e4] text-[#2f3d1f]  max-w-3xl mx-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 md:px-8 lg:px-0">

        <section className="rounded-[40px] border border-[#efe3c2] bg-[#fff9ee] p-8 shadow-[0_30px_80px_rgba(63,61,27,0.08)]">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b39c68]">
              {stageCopy.title}
            </p>
            <h2 className="serif-display text-3xl text-[#2f4a21]">{stageCopy.subtitle}</h2>
          </div>

          {stage === "welcome" && (
            <div className="mt-8 flex flex-col gap-6">
              <label className="flex flex-col gap-2 text-base font-semibold text-[#3f4e2b]">
                Email
                <input
                  className="w-full rounded-2xl border border-[#e8ddc2] bg-white px-4 py-3 text-base text-[#2f3d1f] outline-none transition focus:border-[#b09b69] focus:bg-[#fffef8]"
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {error && (
                <p className="text-sm font-semibold text-[#b14734]" role="alert">
                  {error}
                </p>
              )}
              <button
                className="w-full rounded-2xl bg-[#2f4a21] px-6 py-4 text-lg font-semibold text-[#fffbe9] shadow-[0_15px_30px_rgba(47,74,33,0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={startTest}
                disabled={isFetchingNames}
                aria-busy={isFetchingNames}
              >
                {isFetchingNames ? "Loading names..." : "Start Assessment"}
              </button>
            </div>
          )}

          {stage === "memorize" && (
            <div className="mt-8 flex flex-col gap-6">
              <div className="flex items-center justify-between text-sm font-semibold text-[#4b5b37]">
                <span>{timer} seconds left</span>
                <button
                  className="text-[#b58c4a] underline decoration-2 underline-offset-4"
                  onClick={skipMemorize}
                >
                  Skip early
                </button>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#f0e4c3]">
                <div
                  className="h-full rounded-full bg-linear-to-r from-[#547236] via-[#d9c27d] to-[#f0e2b2] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {names.map((name) => (
                  <p
                    key={name}
                    className="rounded-2xl border border-[#efe3c2] bg-white px-4 py-6 text-center text-lg font-semibold text-[#364a29] shadow-sm"
                  >
                    {name}
                  </p>
                ))}
              </div>
            </div>
          )}

          {stage === "recall" && (
            <form className="mt-8 flex flex-col gap-6" onSubmit={handleRecallSubmit}>
              <label className="flex flex-col gap-2 text-base font-semibold text-[#3f4e2b]">
                Names you remember
                <textarea
                  className="min-h-55 rounded-3xl border border-[#e8ddc2] bg-white px-5 py-4 text-base text-[#2f3d1f] outline-none transition focus:border-[#b09b69] focus:bg-[#fffef8]"
                  placeholder="E.g. Nora, Miles, Selene, ..."
                  value={recallInput}
                  onChange={(event) => setRecallInput(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-4 text-sm font-semibold text-[#6a7752]">
                <span>{parsedAnswers.length} unique names typed</span>
                <span>Need {TARGET_COUNT} for a perfect score</span>
              </div>
              {error && (
                <p className="text-sm font-semibold text-[#b14734]" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-2xl bg-[#3e532c] px-6 py-4 text-lg font-semibold text-[#fffbe9] shadow-[0_15px_30px_rgba(62,83,44,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCalculatingResult}
                aria-busy={isCalculatingResult}
              >
                {isCalculatingResult ? "Calculating score..." : "Submit answers"}
              </button>
            </form>
          )}

          {stage === "result" && (
            <div className="mt-8 grid gap-6">
              <div className="rounded-3xl border border-[#efe3c2] bg-white p-6 md:grid md:grid-cols-2 md:gap-6">
                <p className="text-sm uppercase tracking-[0.3em] text-[#b39c68]">
                  Final score
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-4">
                  <span className="serif-display text-6xl text-[#2f4a21]">{score}</span>
                  <span className="text-xl font-semibold text-[#7d8a57]">/ {DISPLAY_COUNT}</span>
                </div>
                <p className="mt-4 text-lg font-semibold capitalize text-[#2f4a21]">
                  Status: {statusCopy.label}
                </p>
                <p className="text-base text-[#4f5c39]">{statusCopy.copy}</p>
                <a
                  href="https://mentalathlete.gg/products/pulse-nootropic?variant=50538101702958&selling_plan=692626391342"
                  className="col-span-2 mt-6 block w-full rounded-2xl bg-[#2f4a21] px-6 py-4 text-center text-lg font-semibold text-[#fffbe9] shadow-[0_15px_30px_rgba(47,74,33,0.2)] transition hover:-translate-y-0.5"
                >
                  Get My Free Bottle
                </a>
                <p className="mt-6 text-sm text-[#8a9071]">
                  Resetting in ~5 seconds so you can rerun the drill.
                </p>
                {isSavingResult && (
                  <p className="mt-2 text-sm font-semibold text-[#547236]">
                    Syncing this run
                  </p>
                )}
                {persistenceError && (
                  <p className="mt-2 text-sm font-semibold text-[#b14734]" role="alert">
                    {persistenceError}
                  </p>
                )}
                <div className="mt-4 rounded-2xl border border-[#efe3c2] bg-[#fff9ee] p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b39c68]">
                    Word breakdown
                  </p>
                  <p className="text-sm text-[#5e6b4b]">
                    Correct words feed your score. Incorrect submissions are highlighted so you
                    can spot patterns quickly.
                  </p>
                </div>
              </div>
              <div className="grid gap-6 rounded-3xl border border-[#efe3c2] bg-white p-6 md:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <p className="text-base font-semibold text-[#2f4a21]">Correct Words</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {correctWords.length === 0 && (
                      <p className="rounded-2xl bg-[#f6f1de] px-4 py-3 text-sm text-[#6f6c4c]">
                        No correct words
                      </p>
                    )}
                    {correctWords.map((word) => (
                      <p
                        key={`correct-${word}`}
                        className="rounded-2xl border border-[#dfd1a5] bg-[#f6f1de] px-4 py-2 text-sm font-semibold text-[#364a29]"
                      >
                        {word}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">❌</span>
                    <p className="text-base font-semibold text-[#7d2e1a]">Incorrect Words</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {incorrectWords.length === 0 && (
                      <p className="rounded-2xl bg-[#fde8df] px-4 py-3 text-sm text-[#8a4a3c]">
                        No incorrect entries
                      </p>
                    )}
                    {incorrectWords.map((word) => (
                      <p
                        key={`incorrect-${word}`}
                        className="rounded-2xl border border-[#f5c2b3] bg-[#fde8df] px-4 py-2 text-sm font-semibold text-[#7d2e1a]"
                      >
                        {word}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-[#d9c99f] bg-[#fff5da] p-6">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <p className="text-base font-semibold text-[#2f4a21]">Missed Words</p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {missedWords.length === 0 && (
                    <p className="rounded-2xl bg-[#fff2d8] px-4 py-3 text-sm text-[#6f5a34]">
                      You recalled every name!
                    </p>
                  )}
                  {missedWords.map((word) => (
                    <p
                      key={`missed-${word}`}
                      className="rounded-2xl border border-[#f1d5a8] bg-[#fff2d8] px-4 py-2 text-sm font-semibold text-[#815922]"
                    >
                      {word}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <footer className="rounded-4xl border border-[#efe3c2] bg-[#fffdf5] p-6 text-sm text-[#4f5c39] shadow-[0_20px_60px_rgba(70,60,32,0.08)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p>Boosting recovery chemistry helps memory consolidation.</p>
            <p className="font-semibold text-[#2f4a21]">Hydrate, breathe, and keep training.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
