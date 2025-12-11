import React, { useCallback } from 'react';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  onFileUpload: (content: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        readFile(file);
      } else {
        alert('Por favor, envie um arquivo CSV ou XLS/XLSX.');
      }
    },
    [onFileUpload]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      readFile(e.target.files[0]);
    }
  };

  const getExtension = (file: File) => file.name.split('.').pop()?.toLowerCase();

  const readCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onFileUpload(event.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  const readExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      if (!data) return;
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) {
        alert('Planilha vazia ou inválida.');
        return;
      }
      const csv = XLSX.utils.sheet_to_csv(firstSheet);
      onFileUpload(csv);
    };
    reader.readAsArrayBuffer(file);
  };

  const readFile = (file: File) => {
    const ext = getExtension(file);
    if (ext === 'csv') {
      readCsv(file);
    } else if (ext === 'xls' || ext === 'xlsx') {
      readExcel(file);
    } else {
      alert('Formato inválido. Envie um arquivo CSV ou XLS/XLSX.');
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-green-600 transition-colors bg-white shadow-sm"
    >
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-green-50 rounded-full">
          <Upload className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">Upload da Planilha de Inscrições</h3>
          <p className="text-sm text-gray-500 mt-1">Arraste e solte seu arquivo CSV ou XLS/XLSX aqui, ou clique para selecionar</p>
        </div>
        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={handleChange}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer font-medium shadow-sm transition-all"
        >
          Selecionar Arquivo
        </label>
        <p className="text-xs text-gray-400 mt-2">Formato esperado: CSV ou XLS/XLSX exportado do Google Forms conforme modelo</p>
      </div>
    </div>
  );
};
