import type { ChangeEvent, RefObject } from "react";
import { Button } from "../../components/ui/Button";
import { Popup } from "../../components/ui/Popup";

type DataVaultUploadPopupProps = {
  accept: string;
  fileFeedback: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isReadingFiles: boolean;
  selectedCategoryName: string;
  onClose: () => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function DataVaultUploadPopup({
  accept,
  fileFeedback,
  inputRef,
  isReadingFiles,
  selectedCategoryName,
  onClose,
  onFileInputChange
}: DataVaultUploadPopupProps) {
  return (
    <Popup
      eyebrow="데이터 업로드"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button disabled={isReadingFiles} onClick={() => inputRef.current?.click()}>
            {isReadingFiles ? "파일 읽는 중" : "업로드"}
          </Button>
        </div>
      }
      placement="right"
      size="md"
      title="원천 데이터 업로드"
      tone="info"
      onClose={onClose}
    >
      <div className="space-y-4">
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          multiple
          accept={accept}
          onChange={onFileInputChange}
        />

        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <p className="text-sm font-bold text-slate-950">파일을 드래그하거나 선택하세요</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">CSV, XLSX, XLS 파일을 데이터 보관함에 추가합니다.</p>
          <Button className="mt-4 h-9 px-3" disabled={isReadingFiles} variant="secondary" onClick={() => inputRef.current?.click()}>
            파일 선택
          </Button>
        </div>

        {fileFeedback && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            {fileFeedback}
          </div>
        )}

        <div className="rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600">
          <p className="font-bold text-slate-950">선택 분류: {selectedCategoryName}</p>
          <p className="mt-1">업로드 후 원천 기록에서 파일명과 파일 종류만 보정할 수 있으며, AI 구조 초안과 현재 기준 반영은 샘플 기준으로 표시됩니다.</p>
        </div>
      </div>
    </Popup>
  );
}
