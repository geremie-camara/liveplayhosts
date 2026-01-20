"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  linkedin: string;
  otherSocial: string;
  experience: string;
}

type SubmitStatus = "idle" | "uploading" | "submitting" | "success" | "error";

export default function ApplicationForm() {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [headshotFile, setHeadshotFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headshotInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
      if (!validTypes.includes(file.type)) {
        setErrorMessage("Please upload a valid video file (MP4, MOV, WebM, or AVI)");
        return;
      }
      // Validate file size (max 500MB)
      if (file.size > 500 * 1024 * 1024) {
        setErrorMessage("Video file must be less than 500MB");
        return;
      }
      setVideoFile(file);
      setErrorMessage("");
    }
  };

  const handleHeadshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!validTypes.includes(file.type)) {
        setErrorMessage("Please upload a valid image file (JPEG, PNG, WebP, or GIF)");
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage("Image file must be less than 10MB");
        return;
      }
      setHeadshotFile(file);
      setErrorMessage("");

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setHeadshotPreview(previewUrl);
    }
  };

  const uploadFileToS3 = async (file: File): Promise<string> => {
    // Get pre-signed URL from our API
    const response = await fetch(
      `/api/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
    );

    if (!response.ok) {
      throw new Error("Failed to get upload URL");
    }

    const { uploadUrl, fileUrl } = await response.json();

    // Upload file directly to S3
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          resolve(fileUrl);
        } else {
          reject(new Error("Upload failed"));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed"));
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  };

  const onSubmit = async (data: FormData) => {
    try {
      setSubmitStatus("uploading");
      setErrorMessage("");

      let videoUrl = "";
      let headshotUrl = "";

      // Upload headshot if provided
      if (headshotFile) {
        headshotUrl = await uploadFileToS3(headshotFile);
      }

      // Upload video if provided
      if (videoFile) {
        videoUrl = await uploadFileToS3(videoFile);
      }

      setSubmitStatus("submitting");

      // Submit form data to our API
      const response = await fetch("/api/hosts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          videoReelUrl: videoUrl,
          headshotUrl: headshotUrl,
          source: "application", // Marks this as a public application
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit application");
      }

      setSubmitStatus("success");
      reset();
      setVideoFile(null);
      setHeadshotFile(null);
      setHeadshotPreview(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (headshotInputRef.current) {
        headshotInputRef.current.value = "";
      }
    } catch (error) {
      setSubmitStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      );
    }
  };

  if (submitStatus === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-green-800 mb-2">
          Application Submitted!
        </h3>
        <p className="text-green-700">
          Thank you for applying. We&apos;ll review your application and get back to
          you soon.
        </p>
        <button
          onClick={() => setSubmitStatus("idle")}
          className="mt-6 text-primary font-semibold hover:underline"
        >
          Submit another application
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-gray-50 rounded-2xl p-8 space-y-6"
    >
      {/* Name Fields */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-dark mb-2">
            First Name *
          </label>
          <input
            type="text"
            id="firstName"
            {...register("firstName", { required: "First name is required" })}
            className="input-field"
            placeholder="John"
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-dark mb-2">
            Last Name *
          </label>
          <input
            type="text"
            id="lastName"
            {...register("lastName", { required: "Last name is required" })}
            className="input-field"
            placeholder="Doe"
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      {/* Email & Phone */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-dark mb-2">
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Invalid email address",
              },
            })}
            className="input-field"
            placeholder="john@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-dark mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            id="phone"
            {...register("phone", { required: "Phone number is required" })}
            className="input-field"
            placeholder="(555) 123-4567"
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
          )}
        </div>
      </div>

      {/* Address */}
      <div>
        <label htmlFor="street" className="block text-sm font-medium text-dark mb-2">
          Street Address *
        </label>
        <input
          type="text"
          id="street"
          {...register("street", { required: "Street address is required" })}
          className="input-field"
          placeholder="123 Main St"
        />
        {errors.street && (
          <p className="mt-1 text-sm text-red-600">{errors.street.message}</p>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-dark mb-2">
            City *
          </label>
          <input
            type="text"
            id="city"
            {...register("city", { required: "City is required" })}
            className="input-field"
            placeholder="Los Angeles"
          />
          {errors.city && (
            <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-dark mb-2">
            State *
          </label>
          <input
            type="text"
            id="state"
            {...register("state", { required: "State is required" })}
            className="input-field"
            placeholder="CA"
          />
          {errors.state && (
            <p className="mt-1 text-sm text-red-600">{errors.state.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="zip" className="block text-sm font-medium text-dark mb-2">
            ZIP Code *
          </label>
          <input
            type="text"
            id="zip"
            {...register("zip", { required: "ZIP code is required" })}
            className="input-field"
            placeholder="90001"
          />
          {errors.zip && (
            <p className="mt-1 text-sm text-red-600">{errors.zip.message}</p>
          )}
        </div>
      </div>

      {/* Social Profiles */}
      <div>
        <h3 className="text-lg font-semibold text-dark mb-4">Social Profiles</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="instagram" className="block text-sm font-medium text-dark mb-2">
              Instagram
            </label>
            <input
              type="text"
              id="instagram"
              {...register("instagram")}
              className="input-field"
              placeholder="@yourusername"
            />
          </div>
          <div>
            <label htmlFor="tiktok" className="block text-sm font-medium text-dark mb-2">
              TikTok
            </label>
            <input
              type="text"
              id="tiktok"
              {...register("tiktok")}
              className="input-field"
              placeholder="@yourusername"
            />
          </div>
          <div>
            <label htmlFor="youtube" className="block text-sm font-medium text-dark mb-2">
              YouTube
            </label>
            <input
              type="text"
              id="youtube"
              {...register("youtube")}
              className="input-field"
              placeholder="Channel URL or @handle"
            />
          </div>
          <div>
            <label htmlFor="linkedin" className="block text-sm font-medium text-dark mb-2">
              LinkedIn
            </label>
            <input
              type="text"
              id="linkedin"
              {...register("linkedin")}
              className="input-field"
              placeholder="Profile URL"
            />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="otherSocial" className="block text-sm font-medium text-dark mb-2">
            Other Social Profiles
          </label>
          <input
            type="text"
            id="otherSocial"
            {...register("otherSocial")}
            className="input-field"
            placeholder="Twitter, Twitch, etc."
          />
        </div>
      </div>

      {/* Experience */}
      <div>
        <label htmlFor="experience" className="block text-sm font-medium text-dark mb-2">
          Tell us about your hosting experience *
        </label>
        <textarea
          id="experience"
          {...register("experience", {
            required: "Please tell us about your experience",
          })}
          rows={5}
          className="input-field resize-none"
          placeholder="Share your background in hosting, live streaming, or content creation. Include any relevant skills, achievements, or experience that would make you a great LivePlay Host."
        />
        {errors.experience && (
          <p className="mt-1 text-sm text-red-600">{errors.experience.message}</p>
        )}
      </div>

      {/* Headshot Upload */}
      <div>
        <label className="block text-sm font-medium text-dark mb-2">
          Headshot Photo *
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors duration-200">
          <input
            type="file"
            ref={headshotInputRef}
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleHeadshotChange}
            className="hidden"
            id="headshotUpload"
          />
          <label
            htmlFor="headshotUpload"
            className="cursor-pointer"
          >
            {headshotPreview ? (
              <div className="flex flex-col items-center">
                <img
                  src={headshotPreview}
                  alt="Headshot preview"
                  className="w-32 h-32 object-cover rounded-full mb-4"
                />
                <p className="text-primary font-medium">{headshotFile?.name}</p>
                <p className="text-sm text-gray-500 mt-1">Click to change</p>
              </div>
            ) : (
              <div>
                <svg
                  className="w-12 h-12 text-gray-400 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <p className="text-gray-600">
                  <span className="text-primary font-medium">Click to upload</span> your headshot
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  JPEG, PNG, WebP, or GIF (max 10MB)
                </p>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Video Upload */}
      <div>
        <label className="block text-sm font-medium text-dark mb-2">
          Video Reel
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors duration-200">
          <input
            type="file"
            ref={fileInputRef}
            accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
            onChange={handleFileChange}
            className="hidden"
            id="videoUpload"
          />
          <label
            htmlFor="videoUpload"
            className="cursor-pointer"
          >
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            {videoFile ? (
              <div>
                <p className="text-primary font-medium">{videoFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600">
                  <span className="text-primary font-medium">Click to upload</span> or
                  drag and drop
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  MP4, MOV, WebM, or AVI (max 500MB)
                </p>
              </div>
            )}
          </label>
        </div>
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitStatus === "uploading" || submitStatus === "submitting"}
        className="w-full btn-cta text-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitStatus === "uploading"
          ? "Uploading Video..."
          : submitStatus === "submitting"
          ? "Submitting Application..."
          : "Submit Application"}
      </button>

      <p className="text-sm text-gray-500 text-center">
        By submitting this application, you agree to our terms of service and
        privacy policy.
      </p>
    </form>
  );
}
