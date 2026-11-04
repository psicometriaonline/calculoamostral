import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface SampleSizeParameterInfo {
  name: string;
  description: React.ReactNode;
}

export interface SampleSizeInfoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary?: React.ReactNode;
  parameters?: SampleSizeParameterInfo[];
  guidelines?: React.ReactNode;
  example?: React.ReactNode;
  references?: string[];
}

function SampleSizeInfoModal({
  isOpen,
  onOpenChange,
  title,
  summary,
  parameters,
  guidelines,
  example,
  references,
}: SampleSizeInfoModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="bg-blue-50 px-6 pt-4 pb-3 border-b flex-shrink-0 rounded-t-lg">
          <DialogTitle className="text-xl text-primary font-bold">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {summary && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Descrição</h3>
                <div className="p-4 bg-blue-50 rounded-md text-sm">
                  {summary}
                </div>
              </div>
            )}

            {parameters && parameters.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Parâmetros</h3>
                <div className="p-4 bg-blue-50 rounded-md">
                  <dl className="space-y-2">
                    {parameters.map((param, idx) => (
                      <div key={idx}>
                        <dt className="font-semibold">{param.name}</dt>
                        <dd className="text-sm pl-2">{param.description}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}

            {guidelines && (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Diretrizes de escolha e interpretação
                </h3>
                <div className="p-4 bg-blue-50 rounded-md">{guidelines}</div>
              </div>
            )}

            {example && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Exemplo de uso</h3>
                <div className="p-4 bg-blue-50 rounded-md">{example}</div>
              </div>
            )}

            {references && references.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Referências</h3>
                <div className="p-4 bg-blue-50 rounded-md">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {references.map((ref, idx) => (
                      <li key={idx}>{ref}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { SampleSizeInfoModal };
