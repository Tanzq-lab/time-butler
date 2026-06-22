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

const STEP_ICON_COLOR = "bg-sahara-primary-light text-sahara-primary";

const steps = [
  {
    title: "欢迎使用时间管家",
    subtitle: "把注意力安放在该做的事上。",
    description:
      "时间管家帮助你用有意图的专注时段收回注意力，进入更稳定的工作节奏。",
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
    <div className="h-screen bg-sahara-bg flex items-center justify-center p-4 md:p-8 overflow-hidden">
      <div className="max-w-3xl md:max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-sahara-surface rounded-3xl md:rounded-[40px] shadow-2xl shadow-sahara-primary/10 overflow-hidden border border-sahara-border/20 min-h-auto md:min-h-150">
        {/* Brand panel */}
        <div className="bg-sahara-primary p-6 sm:p-10 md:p-16 flex flex-col justify-between text-white relative order-last md:order-first">
          <div className="absolute inset-0 opacity-10 pointer-events-none hidden md:block">
            <div className="absolute top-[-10%] right-[-10%] size-[60%] rounded-full border-40 border-white"></div>
            <div className="absolute bottom-[10%] left-[-20%] size-[80%] rounded-full border-20 border-white"></div>
          </div>

          <div>
            <h1 className="font-serif text-2xl md:text-4xl tracking-tight mb-1 md:mb-2">
              时间管家
            </h1>
            <p className="text-[9px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] font-bold uppercase opacity-70">
              专注 · 记录 · 复盘
            </p>
          </div>

          <div className="relative z-10 py-4 md:py-0">
            <h2 className="font-serif text-2xl sm:text-3xl md:text-5xl leading-tight mb-3 md:mb-6">
              {currentStep.title}
            </h2>
            <p className="text-white/80 text-sm md:text-lg font-medium leading-relaxed">
              {currentStep.subtitle}
            </p>
          </div>

          <div className="flex gap-1.5 md:gap-2">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === step
                    ? "w-6 md:w-8 bg-sahara-surface"
                    : "w-1.5 md:w-2 bg-sahara-surface/30",
                )}
              />
            ))}
          </div>
        </div>

        {/* Content and actions */}
        <div className="p-6 sm:p-8 md:p-16 flex flex-col justify-between">
          <div className="flex justify-end">
            <Button
              variant="link"
              intent="default"
              size="xs"
              className="text-[9px] md:text-[10px] tracking-widest uppercase"
              onClick={() => completeOnboarding()}
            >
              跳过引导
            </Button>
          </div>

          <div className="space-y-5 md:space-y-8">
            <div
              className={cn(
                "size-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-lg shadow-sahara-primary/10",
                STEP_ICON_COLOR,
              )}
            >
              <currentStep.icon className="size-7 sm:w-8 sm:h-8 md:w-10 md:h-10" />
            </div>

            <div className="space-y-3 md:space-y-4">
              <h3 className="font-serif text-xl sm:text-2xl md:text-3xl text-sahara-text">
                {currentStep.title}
              </h3>
              <p className="text-sm md:text-base text-sahara-text-secondary leading-relaxed">
                {currentStep.description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-5 md:pt-8 border-t border-sahara-border/10 mt-5 md:mt-0">
            <Button
              variant="ghost"
              size="sm"
              intent="default"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className={cn(
                "gap-1.5 md:gap-2 text-[10px] md:text-xs tracking-widest",
                step === 0 && "text-sahara-border",
              )}
            >
              <ChevronLeft className="size-3.5 md:w-4 md:h-4" />
              上一步
            </Button>

            {step === steps.length - 1 ? (
              <Button
                variant="solid"
                intent="sahara"
                size="lg"
                shape="rounded-full"
                onClick={() => completeOnboarding()}
                className="hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-sahara-primary/20 text-[10px] sm:text-xs tracking-widest font-bold uppercase px-5 md:px-7 py-2.5 md:py-3 transition-all"
              >
                开始使用
              </Button>
            ) : (
              <Button
                variant="solid"
                intent="sahara"
                size="md"
                shape="rounded-full"
                onClick={() =>
                  setStep((s) => Math.min(steps.length - 1, s + 1))
                }
                className="gap-1.5 md:gap-2 shadow-lg shadow-sahara-primary/20 hover:shadow-xl hover:shadow-sahara-primary/30 group text-[10px] sm:text-xs tracking-widest font-bold uppercase px-5 md:px-7 py-2.5 md:py-3 transition-all"
              >
                继续
                <ChevronRight className="size-3.5 md:w-4 md:h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
