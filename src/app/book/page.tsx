"use client";

import { addDays, format, isSameDay, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { AvailabilityResponse, BookResponse, TimeSlot } from "@/types";

type Step = "datetime" | "form" | "confirm" | "success";

export default function BookingPage() {
  return (
    <Suspense>
      <BookingPageInner />
    </Suspense>
  );
}

function BookingPageInner() {
  const searchParams = useSearchParams();
  const source = searchParams.get("from") || "";
  const recruiter = searchParams.get("recruiter") || "";
  const [step, setStep] = useState<Step>("datetime");
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [dates, setDates] = useState<Date[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seekerName, setSeekerName] = useState("");
  const [seekerEmail, setSeekerEmail] = useState("");
  const [seekerCompany, setSeekerCompany] = useState("");

  const [bookingResult, setBookingResult] = useState<BookResponse | null>(null);

  useEffect(() => {
    const maxDays = 14;
    const dateList: Date[] = [];
    for (let i = 0; i < maxDays; i++) {
      dateList.push(addDays(new Date(), i));
    }
    setDates(dateList);
  }, []);

  const fetchSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setError(null);
    try {
      const res = await fetch(`/api/availability?date=${date}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "空き枠の取得に失敗しました");
      }
      const data: AvailabilityResponse = await res.json();
      setSlots(data.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    setSelectedSlot(slot);
    setStep("form");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seekerName,
          seekerEmail,
          seekerCompany,
          startTime: selectedSlot.start,
          source,
          recruiter,
        }),
      });

      const data: BookResponse = await res.json();

      if (!data.success) {
        throw new Error(data.error || "予約に失敗しました");
      }

      setBookingResult(data);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "予約に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const formatSlotTime = (iso: string) => {
    return format(parseISO(iso), "HH:mm", { locale: ja });
  };

  const formatSelectedDateTime = () => {
    if (!selectedSlot) return "";
    const start = parseISO(selectedSlot.start);
    return format(start, "yyyy年M月d日(E) HH:mm", { locale: ja });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="border-b border-brand-100 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <h1 className="text-2xl font-bold text-brand-700">初回面談予約</h1>
          <p className="mt-1 text-sm text-gray-600">
            ご都合の良い日時をお選びください。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-center gap-2">
          {(["datetime", "form", "success"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step === s || (step === "success" && s !== "success" ? false : step === s)
                    ? "bg-brand-600 text-white"
                    : (s === "datetime" && (step === "form" || step === "success")) || (s === "form" && step === "success")
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {(s === "datetime" && (step === "form" || step === "success")) || (s === "form" && step === "success") ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className="text-sm text-gray-600">
                {s === "datetime" ? "日時選択" : s === "form" ? "情報入力" : "日程調整完了"}
              </span>
              {i < 2 && <div className="mx-2 h-px w-8 bg-gray-300" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === "datetime" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">日付を選択</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((date) => {
                  const dateStr = format(date, "yyyy-MM-dd");
                  const isSelected = selectedDate === dateStr;
                  const isToday = isSameDay(date, new Date());

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`flex min-w-[72px] flex-col items-center rounded-lg border px-3 py-3 transition ${
                        isSelected
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-gray-200 hover:border-brand-300"
                      }`}
                    >
                      <span className="text-xs text-gray-500">
                        {format(date, "M/d", { locale: ja })}
                      </span>
                      <span className="text-sm font-medium">
                        {format(date, "E", { locale: ja })}
                      </span>
                      {isToday && (
                        <span className="mt-1 text-[10px] text-brand-600">今日</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">時間を選択</h2>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                </div>
              ) : slots.filter((s) => s.available).length === 0 ? (
                <p className="py-8 text-center text-gray-500">
                  この日は空き枠がありません。別の日をお選びください。
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {slots
                    .filter((s) => s.available)
                    .map((slot) => (
                      <button
                        key={slot.start}
                        onClick={() => handleSlotSelect(slot)}
                        className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100 hover:border-brand-400"
                      >
                        {formatSlotTime(slot.start)}
                      </button>
                    ))}
                </div>
              )}
            </section>
          </div>
        )}

        {step === "form" && selectedSlot && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 rounded-lg bg-brand-50 px-4 py-3">
              <p className="text-sm text-gray-600">選択した日時</p>
              <p className="font-semibold text-brand-700">{formatSelectedDateTime()}</p>
              <p className="text-sm text-gray-500">面談時間: 30〜60分</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={seekerName}
                  onChange={(e) => setSeekerName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  placeholder="山田 太郎"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={seekerEmail}
                  onChange={(e) => setSeekerEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  placeholder="example@email.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  確認メールとZoomリンクをお送りします
                </p>
              </div>

              <div>
                <label htmlFor="company" className="mb-1 block text-sm font-medium text-gray-700">
                  会社名
                </label>
                <input
                  id="company"
                  type="text"
                  value={seekerCompany}
                  onChange={(e) => setSeekerCompany(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  placeholder="株式会社〇〇"
                />
              </div>


              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep("datetime");
                    setError(null);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  戻る
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting ? "予約中..." : "予約を確定する"}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "success" && bookingResult && (
          <div className="rounded-xl border border-green-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
              <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-green-800">日程調整が完了しました</p>
                <p className="text-sm text-green-700">ご入力いただいたメールアドレスに予定の招待を送信しました。</p>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
                <span className="text-gray-400 mt-0.5">📅</span>
                <div>
                  <p className="font-semibold">{formatSelectedDateTime()}</p>
                  <p className="text-gray-500">アジア/東京 (UTC+09:00)</p>
                </div>
              </div>

              {bookingResult.zoomJoinUrl && (
                <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
                  <span className="text-gray-400 mt-0.5">📹</span>
                  <div>
                    <p className="font-medium">Zoom</p>
                    <a
                      href={bookingResult.zoomJoinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {bookingResult.zoomJoinUrl}
                    </a>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <span className="text-gray-400 mt-0.5">💬</span>
                <div className="text-gray-700 space-y-2">
                  <p>この度はご面談の日程調整いただきありがとうございます。</p>
                  <p>求人情報から転職相談まで幅広い情報をご提供させていただきます。</p>
                  <p>当日は、どうぞよろしくお願いいたします。</p>
                  <p>
                    もしよろしければ下記のアドレスまで、事前に履歴書、職務経歴書をword形式でお送りいただけますと、初回から確認と修正ができ、スムーズです。<br />
                    <a href="mailto:liquet@careersuite.jp" className="text-blue-600 hover:underline">liquet@careersuite.jp</a>
                  </p>
                  <p>また有意義な面談実施のため、面談前アンケートを準備しております。</p>
                  <p>
                    お手すきの際にご回答いただけますと幸いでございます。<br />
                    アンケートURL：{" "}
                    <a
                      href="https://forms.gle/AhvhSZCdvAKDxGde6"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      https://forms.gle/AhvhSZCdvAKDxGde6
                    </a>
                  </p>
                  <p>ご不明な点がございましたら、いつでもお気軽にご連絡ください。</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-gray-200 py-6 text-center text-xs text-gray-400">
        キャリア面談予約システム
      </footer>
    </div>
  );
}

