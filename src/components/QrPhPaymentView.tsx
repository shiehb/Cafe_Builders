import React, { useState, useEffect } from "react";
import { CheckCircle2, Copy, ShieldCheck, Clock, RefreshCw, Smartphone } from "lucide-react";
import { Order } from "../types";
import { formatPrice } from "../lib/utils";

interface QrPhPaymentViewProps {
  order: Order;
  qrCodeUrl: string;
  onPaymentConfirmed: (updatedOrder: Order) => void;
  onCancel: () => void;
}

export const QrPhPaymentView: React.FC<QrPhPaymentViewProps> = ({
  order,
  qrCodeUrl,
  onPaymentConfirmed,
  onCancel,
}) => {
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(900); // 15 minutes dynamic QR expiration
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Expiration countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const copyReference = () => {
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simulate payment confirmation (e.g. when customer scans and pays via GCash/Maya)
  const handleSimulateSuccessfulPayment = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });

      if (res.ok) {
        const data = await res.json();
        onPaymentConfirmed(data.order || { ...order, status: "PAID" });
      } else {
        onPaymentConfirmed({ ...order, status: "PAID" });
      }
    } catch {
      onPaymentConfirmed({ ...order, status: "PAID" });
    } finally {
      setIsSimulating(false);
    }
  };

  const supportedApps = [
    { name: "GCash", color: "bg-blue-600" },
    { name: "Maya", color: "bg-emerald-600" },
    { name: "ShopeePay", color: "bg-orange-500" },
    { name: "BPI", color: "bg-red-800" },
    { name: "UnionBank", color: "bg-amber-600" },
    { name: "BDO / Any Bank", color: "bg-blue-900" },
  ];

  return (
    <div className="flex flex-col items-center text-center space-y-4">
      {/* Header Banner */}
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-full text-xs font-bold">
        <Clock className="h-3.5 w-3.5 text-[#00A86B]" />
        <span>QR Expires in {formattedTime}</span>
      </div>

      {/* QR Card Container */}
      <div className="relative bg-white p-4 sm:p-5 rounded-2xl border-2 border-stone-800 shadow-lg max-w-xs w-full flex flex-col items-center">
        {/* QR Ph Standard Header */}
        <div className="flex items-center justify-between w-full mb-3 pb-2 border-b border-stone-100">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-600" />
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="font-black text-xs tracking-wider text-stone-900">QR PH</span>
          </div>
          <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
            Person-to-Merchant
          </span>
        </div>

        {/* Dynamic QR Code Image */}
        <div className="relative bg-white p-2 rounded-xl border border-stone-200 shadow-inner flex items-center justify-center">
          <img
            src={qrCodeUrl}
            alt="PayMongo Dynamic QR Ph"
            className="h-48 w-48 object-contain rounded-lg"
          />
        </div>

        {/* Amount & Reference Details */}
        <div className="mt-4 text-center w-full">
          <span className="text-[11px] font-bold uppercase text-stone-400 tracking-wider">
            Total Payable Amount
          </span>
          <div className="text-2xl font-black text-stone-900 font-display tracking-tight">
            {formatPrice(order.totalAmount)}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-stone-600">
            <span>Ticket: <strong className="text-stone-900 font-mono">{order.orderNumber}</strong></span>
            <button
              type="button"
              onClick={copyReference}
              aria-label="Copy ticket number"
              className="text-stone-400 hover:text-stone-700 p-0.5"
            >
              <Copy className="h-3 w-3" />
            </button>
            {copied && <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>}
          </div>
        </div>
      </div>

      {/* Supported Payment Apps */}
      <div className="w-full max-w-sm pt-2">
        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">
          Scan with Any Philippine E-Wallet or Banking App
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {supportedApps.map((app) => (
            <span
              key={app.name}
              className="inline-flex items-center px-2 py-1 rounded-lg bg-stone-100 text-[11px] font-semibold text-stone-700 border border-stone-200"
            >
              <Smartphone className="h-3 w-3 mr-1 text-stone-500" />
              {app.name}
            </span>
          ))}
        </div>
      </div>

      {/* Security note & Simulation Trigger */}
      <div className="w-full max-w-sm pt-2 space-y-3">
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-left flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-[#00A86B] shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-950 leading-relaxed">
            Once payment is completed on your phone, the kitchen screen immediately receives your order with ticket <strong>{order.orderNumber}</strong>.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={handleSimulateSuccessfulPayment}
            disabled={isSimulating}
            className="w-full h-11 rounded-full bg-[#00A86B] hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Verifying payment...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Simulate Completed QR Ph Scan</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
          >
            Change Payment Method or Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
