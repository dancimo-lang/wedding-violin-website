import { presentSignedContract } from '@/lib/contracts/signature-style';

const frameClass =
  'contract-document md:max-h-[36rem] md:overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 font-serif text-sm leading-6';

/**
 * Draws a locked agreement. Signature names use the script font, and a Pacific-time
 * line is added under each signature that has a stored timestamp. The source text is not edited.
 */
export function ContractText({
  text,
  clientSignedAt = null,
  musicianSignedAt = null,
  className = '',
}: {
  text: string;
  clientSignedAt?: string | null;
  musicianSignedAt?: string | null;
  className?: string;
}) {
  const segments = presentSignedContract(text, { clientSignedAt, musicianSignedAt });
  return (
    <div className={className ? `${frameClass} ${className}` : frameClass}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') return <span key={index}>{segment.text}</span>;
        return (
          <span key={index}>
            <span className="contract-signature-block">
              <span>Signature:</span>
              <span className="contract-signature-name">{segment.name}</span>
              {segment.caption ? <span className="contract-signature-caption">{segment.caption}</span> : null}
            </span>
            {segment.newline}
          </span>
        );
      })}
    </div>
  );
}
