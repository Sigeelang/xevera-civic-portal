/*
 * ResidentPageHeader — plain page header matching the Community Reports
 * style: title + description only. No image, no badge, no blue banner.
 * Used on resident Announcements, Maintenance, and Emergency Contacts.
 * Public (logged-out) views keep the ServiceBanner photo banner.
 */
export default function ResidentPageHeader({ title, description }) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-2 sm:pt-10">
      <h1 className="text-[22px] md:text-[27px] font-extrabold text-[#122B54] tracking-[-0.6px] leading-[1.1]">
        {title}
      </h1>
      {description && (
        <p className="mt-1.5 text-xs md:text-[13px] text-[#617493] leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
