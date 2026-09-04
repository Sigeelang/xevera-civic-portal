import { WORKFLOW_STEPS } from '../../utils/reportStatus';

export default function ReportWorkflow({ status }) {
  const currentIndex = WORKFLOW_STEPS.indexOf(status);

  return (
    <div className="w-full">
      <div className="flex items-center">
        {WORKFLOW_STEPS.map((step, index) => {
          const completed = currentIndex >= index;
          const current = currentIndex === index;
          return (
            <div key={step} className="flex-1 flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-extrabold border-2 transition-colors ${
                    completed ? 'bg-[#1769ED] border-[#1769ED] text-white' : 'bg-white border-[#E2E8F0] text-[#94A3B8]'
                  } ${current ? 'ring-4 ring-[#1769ED]/15' : ''}`}
                >
                  {index + 1}
                </div>
                <span className={`mt-2 text-[9px] font-bold text-center whitespace-nowrap ${completed ? 'text-[#1769ED]' : 'text-[#94A3B8]'}`}>
                  {step}
                </span>
              </div>
              {index < WORKFLOW_STEPS.length - 1 && (
                <div className={`flex-1 h-[2px] mx-1.5 -mt-5 ${currentIndex > index ? 'bg-[#1769ED]' : 'bg-[#E2E8F0]'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}