import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Search, MapPin } from "lucide-react";

const searchSchema = z.object({
  service: z.string().trim().min(1, "Please enter a service"),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Please enter a valid 6-digit pincode"),
});

const HeroSearch: React.FC = () => {
  const navigate = useNavigate();

  const [service, setService] = useState("");
  const [pincode, setPincode] = useState("");

  const [errors, setErrors] = useState<{
    service?: string;
    pincode?: string;
  }>({});

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = searchSchema.safeParse({
      service: service.trim(),
      pincode: pincode.trim(),
    });

    // Validation failed
    if (!result.success) {
      const fieldErrors: {
        service?: string;
        pincode?: string;
      } = {};

      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field === "service") {
          fieldErrors.service = issue.message;
        }
        if (field === "pincode") {
          fieldErrors.pincode = issue.message;
        }
      });

      setErrors(fieldErrors);
      return;
    }

    // Validation successful
    setErrors({});

    const queryParams = new URLSearchParams({
      q: result.data.service,
      pincode: result.data.pincode,
    });

    navigate(`/services?${queryParams.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
        {/* Service Input */}
        <div className="flex-1 min-w-0">
          <label
            htmlFor="service-search"
            className="mb-1.5 block text-xs font-bold text-slate-800"
          >
            What service do you need?
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="service-search"
              name="service"
              type="text"
              value={service}
              onChange={(event) => {
                setService(event.target.value);
                if (errors.service) {
                  setErrors((prev) => ({ ...prev, service: undefined }));
                }
              }}
              placeholder="Search for a service (e.g., AC service, cleaning)"
              aria-invalid={Boolean(errors.service)}
              aria-describedby={errors.service ? "service-error" : undefined}
              className={`h-12 w-full rounded-xl border bg-white pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:ring-2 ${
                errors.service
                  ? "border-red-500 focus:ring-red-200"
                  : "border-slate-200 focus:border-[#f97316] focus:ring-[#f97316]/20"
              }`}
            />
          </div>
          {errors.service && (
            <p id="service-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.service}
            </p>
          )}
        </div>

        {/* Pincode Input */}
        <div className="w-full sm:w-44 md:w-48 lg:w-56 min-w-0">
          <label
            htmlFor="pincode"
            className="mb-1.5 block text-xs font-bold text-slate-800"
          >
            Pincode
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="pincode"
              name="pincode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(event) => {
                setPincode(event.target.value);
                if (errors.pincode) {
                  setErrors((prev) => ({ ...prev, pincode: undefined }));
                }
              }}
              placeholder="Enter 6-digit pincode"
              aria-invalid={Boolean(errors.pincode)}
              aria-describedby={errors.pincode ? "pincode-error" : undefined}
              className={`h-12 w-full rounded-xl border bg-white pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:ring-2 ${
                errors.pincode
                  ? "border-red-500 focus:ring-red-200"
                  : "border-slate-200 focus:border-[#f97316] focus:ring-[#f97316]/20"
              }`}
            />
          </div>
          {errors.pincode && (
            <p id="pincode-error" className="mt-1 text-xs text-red-600" role="alert">
              {errors.pincode}
            </p>
          )}
        </div>

        {/* Search Button */}
        <button
          type="submit"
          className="group h-12 w-full sm:w-auto px-7 rounded-xl bg-gradient-to-r from-[#ff8a3d] to-[#f97316] hover:from-[#f97316] hover:to-[#ea580c] text-white font-bold text-sm shadow-[0_10px_25px_-5px_rgba(249,115,22,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-5px_rgba(249,115,22,0.5)] active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[#ff8a3d] focus:ring-offset-2 flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
        >
          <span>Search</span>
          <Search className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
        </button>
      </div>
    </form>
  );
};

export default HeroSearch;
