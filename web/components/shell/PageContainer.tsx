export function PageContainer({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  /* wide: 社区等列表页在桌面放宽为多列 */
  wide?: boolean;
}) {
  return (
    <div
      className={`mx-auto w-full px-[22px] pt-8 pb-10 md:pt-12 ${
        wide ? "max-w-[1040px]" : "max-w-[680px]"
      }`}
    >
      {children}
    </div>
  );
}
