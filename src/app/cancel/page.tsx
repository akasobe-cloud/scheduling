"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

export default function CancelPage() {
  return (
    <Suspense>
      <CancelPageInner />
    </Suspense>
  );
}

function CancelPageInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleCancel = async () => {
    if (!bookingId) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center">
      <div className="max-w-md w-full mx-4 rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        {status === "success" ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">キャンセルが完了しました</h2>
            <p className="mt-2 text-gray-600">ご予約をキャンセルしました。またのご予約をお待ちしております。</p>
            <a href="/book" className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
              新しく予約する
            </a>
          </>
        ) : status === "error" ? (
          <>
            <h2 className="text-xl font-bold text-gray-900">エラーが発生しました</h2>
            <p className="mt-2 text-gray-600">キャンセル処理に失敗しました。すでにキャンセル済みの可能性があります。</p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900">予約をキャンセルしますか？</h2>
            <p className="mt-2 text-gray-600">この操作は取り消せません。</p>
            <div className="mt-6 flex gap-3 justify-center">
              <a href="/book" className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                戻る
              </a>
              <button
                onClick={handleCancel}
                disabled={status === "loading"}
                className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {status === "loading" ? "処理中..." : "キャンセルする"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
