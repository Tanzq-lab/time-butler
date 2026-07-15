import { useState } from "react";
import { MainLayout } from "@/components/template/main-layout";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { AnalyticsDashboard } from "@/components/containers/analytics";
import { exportAnalyticsPdf } from "@/lib/export-pdf";
import type { DatePeriod } from "@/lib/date-range";
import { PageHeader } from "@/components/ui/page-header";

export function AnalyticsPage() {
  const [period, setPeriod] = useState<DatePeriod>("last7days");
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportAnalyticsPdf(period);
    } catch (err) {
      console.error("[ExportPDF] Failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <PageHeader
          eyebrow="表现概览"
          title="专注洞察"
          description="用趋势、任务和复盘记录看见自己的工作节奏。"
          className="mb-8 md:mb-10"
          actions={<div className="flex gap-2">
            <Button
              variant="outline"
              intent="default"
              size="sm"
              onClick={handleExportPdf}
              disabled={exporting}
              className="gap-1.5 px-4"
              title="导出分析 PDF"
            >
              {exporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              {exporting ? "导出中…" : "导出 PDF"}
            </Button>
          </div>}
        />

        <AnalyticsDashboard period={period} onPeriodChange={setPeriod} />
      </div>
    </MainLayout>
  );
}
