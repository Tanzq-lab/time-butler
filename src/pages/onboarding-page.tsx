import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  Target,
  Zap,
  Clock,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useOnboardingStore } from "@/features/onboarding/use-onboarding-store";

const steps = [
  {
    title: "欢迎使用 Time Butler",
    subtitle: "把注意力安放在该做的事上。",
    description:
      "Time-butler 帮助你用有意图的专注时段收回注意力，进入更稳定的工作节奏。",
    icon: Star,
  },
  {
    title: "专注节奏",
    subtitle: "25 分钟，只做一件事。",
    description:
      "使用精简的番茄钟节奏：专注 25 分钟，休息 5 分钟。每 4 轮后，给自己一段更长的恢复时间。",
    icon: Zap,
  },
  {
    title: "规划今天",
    subtitle: "让任务带着目的前进。",
    description:
      "把专注时段关联到具体任务，记录进度，看见自己的投入如何一点点累积。",
    icon: Target,
  },
  {
    title: "复盘与成长",
    subtitle: "用数据看见自己的节奏。",
    description:
      "查看专注分布、任务完成和连续记录。稳定的节奏，才是深度工作的底气。",
    icon: Clock,
  },
];

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const markComplete = useOnboardingStore((s) => s.markComplete);

  const currentStep = steps[step];

  const completeOnboarding = async () => {
    await markComplete();
    navigate("/");
  };

  return (
    <main className="min-h-dvh overflow-y-auto bg-sahara-bg p-4 text-sahara-text sm:p-6 md:flex md:items-center md:justify-center md:p-10">
      <div className="mx-auto grid w-full max-w-4xl overflow-hidden border border-sahara-border bg-sahara-surface md:min-h-145 md:grid-cols-[15rem_1fr]">
        <aside className="border-b border-sahara-border bg-sahara-card p-5 md:border-b-0 md:border-r md:p-7">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-sahara-primary text-sm font-semibold text-sahara-bg">T</div>
            <div>
              <h1 className="text-sm font-semibold">Time Butler</h1>
              <p className="text-xs text-sahara-text-muted">专注 · 记录 · 复盘</p>
            </div>
          </div>

          <ol className="mt-6 grid grid-cols-4 gap-2 md:mt-12 md:grid-cols-1 md:gap-1">
            {steps.map((item, index) => (
              <li key={item.title}>
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  aria-current={index === step ? "step" : undefined}
                  aria-label={`第 ${index + 1} 步：${item.title}`}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md p-2 text-left text-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus",
                    index === step ? "bg-sahara-surface font-medium text-sahara-text" : "text-sahara-text-muted hover:bg-sahara-surface/70 hover:text-sahara-text",
                  )}
                >
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-[10px]", index === step ? "border-sahara-primary bg-sahara-primary text-sahara-bg" : "border-sahara-border")}>{index + 1}</span>
                  <span className="hidden truncate md:block">{item.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <section className="flex min-h-120 flex-col justify-between p-6 sm:p-9 md:p-12">
          <div className="flex justify-end">
            <Button
              variant="link"
              intent="default"
              size="sm"
              onClick={() => completeOnboarding()}
            >
              跳过引导
            </Button>
          </div>

          <div className="max-w-xl py-8">
            <div className="flex size-11 items-center justify-center rounded-md bg-sahara-primary text-sahara-bg">
              <currentStep.icon className="size-5" strokeWidth={1.8} />
            </div>

            <p className="mt-7 text-sm font-medium text-sahara-text-muted">{currentStep.subtitle}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-sahara-text md:text-4xl">{currentStep.title}</h2>
            <p className="mt-5 text-base leading-7 text-sahara-text-secondary">{currentStep.description}</p>
          </div>

          <div className="flex items-center justify-between border-t border-sahara-border pt-5">
            <Button
              variant="ghost"
              size="sm"
              intent="default"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="gap-1.5"
            >
              <ChevronLeft className="size-3.5 md:w-4 md:h-4" />
              上一步
            </Button>

            {step === steps.length - 1 ? (
              <Button
                variant="solid"
                intent="sahara"
                size="md"
                onClick={() => completeOnboarding()}
                className="px-5"
              >
                开始使用
              </Button>
            ) : (
              <Button
                variant="solid"
                intent="sahara"
                size="md"
                onClick={() =>
                  setStep((s) => Math.min(steps.length - 1, s + 1))
                }
                className="group gap-1.5 px-5"
              >
                继续
                <ChevronRight className="size-3.5 md:w-4 md:h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
