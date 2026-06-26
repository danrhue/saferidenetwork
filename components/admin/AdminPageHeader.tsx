type AdminPageHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function AdminPageHeader({ title, subtitle }: AdminPageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-blue-950">{title}</h1>
      {subtitle && <p className="mt-1 text-blue-800">{subtitle}</p>}
    </div>
  );
}