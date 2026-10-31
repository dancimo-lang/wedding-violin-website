import { Fragment, type ReactNode } from 'react';
import { contractBlocks, signerRoleFor, type ContractBlock } from '@/lib/contracts/layout';
import { SLOT_PATTERN } from '@/lib/contracts/render';
import { formatElectronicSignature, isRecordedSignatureName } from '@/lib/contracts/signature-style';

const frameClass =
  'contract-document md:max-h-[40rem] md:overflow-auto rounded-lg border border-gray-200 bg-white px-4 py-6 font-serif text-[15px] leading-7 sm:px-8';

/** Text with any slot markers swapped for the caller's inline inputs. */
function withSlots(text: string, renderSlot?: (name: string) => ReactNode): ReactNode {
  if (!text.includes('\u27e6')) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(new RegExp(SLOT_PATTERN.source, 'g'))) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const name = match[1] ?? '';
    parts.push(<Fragment key={`${name}-${index}`}>{renderSlot ? renderSlot(name) : null}</Fragment>);
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

type Group = { signer: string | null; blocks: ContractBlock[] };

/** Splits the blocks so each signer in the signature section gets its own card. */
function grouped(blocks: ContractBlock[]): Group[] {
  const groups: Group[] = [];
  let inSignatures = false;
  let current: Group = { signer: null, blocks: [] };
  for (const block of blocks) {
    if (block.kind === 'heading' || (block.kind === 'subheading' && block.text === 'Signatures')) {
      inSignatures = /Signatures?$/.test(block.text);
      if (current.blocks.length) groups.push(current);
      current = { signer: null, blocks: [block] };
      continue;
    }
    if (inSignatures && block.kind === 'subheading' && signerRoleFor(block.text)) {
      if (current.blocks.length) groups.push(current);
      current = { signer: block.text, blocks: [block] };
      continue;
    }
    current.blocks.push(block);
  }
  if (current.blocks.length) groups.push(current);
  return groups;
}

/**
 * Draws an agreement laid out like the owner's original document: centered title,
 * bold numbered sections, lists, and one card per signer. Signature names use the
 * script font, with a Pacific-time line when a timestamp is stored. The source text
 * is not edited. On the signing page, renderSlot draws inline inputs for blanks.
 */
export function ContractText({
  text,
  clientSignedAt = null,
  musicianSignedAt = null,
  className = '',
  renderSlot,
}: {
  text: string;
  clientSignedAt?: string | null;
  musicianSignedAt?: string | null;
  className?: string;
  renderSlot?: (name: string) => ReactNode;
}) {
  const groups = grouped(contractBlocks(text));

  const drawBlock = (block: ContractBlock, index: number, role: 'client' | 'musician' | null) => {
    switch (block.kind) {
      case 'title':
        return (
          <h2 key={index} className="mb-4 text-center text-xl font-bold tracking-wide sm:text-2xl">
            {block.text}
          </h2>
        );
      case 'heading':
        return (
          <h3 key={index} className="mt-6 mb-2 text-base font-bold sm:text-lg">
            {block.text}
          </h3>
        );
      case 'subheading':
        return (
          <p key={index} className={role ? 'font-bold' : 'mt-3 font-semibold'}>
            {block.text}
          </p>
        );
      case 'gap':
        return <div key={index} className="h-1" aria-hidden />;
      case 'list':
        return (
          <ul key={index} className="my-1 list-disc space-y-1 pl-6">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{withSlots(item, renderSlot)}</li>
            ))}
          </ul>
        );
      case 'paragraph':
        return (
          <p key={index} className={role ? '' : 'my-2'}>
            {withSlots(block.text, renderSlot)}
          </p>
        );
      case 'field': {
        const value = block.value.trim();
        if (block.label === 'Signature' && role && !value.includes('\u27e6') && isRecordedSignatureName(value)) {
          const caption = formatElectronicSignature(role === 'musician' ? musicianSignedAt : clientSignedAt);
          return (
            <div key={index} className="contract-field my-1">
              <span className="contract-field-label">Signature:</span>
              <span className="contract-signature-block">
                <span className="contract-signature-name">{value}</span>
                {caption ? <span className="contract-signature-caption">{caption}</span> : null}
              </span>
            </div>
          );
        }
        return (
          <div key={index} className="contract-field my-0.5">
            <span className="contract-field-label">{block.label}:</span>{' '}
            <span className="contract-field-value">{withSlots(block.value, renderSlot)}</span>
          </div>
        );
      }
    }
  };

  return (
    <div className={className ? `${frameClass} ${className}` : frameClass}>
      {groups.map((group, groupIndex) => {
        const role = group.signer ? signerRoleFor(group.signer) : null;
        const content = group.blocks.map((block, index) => drawBlock(block, index, role));
        if (!group.signer) return <Fragment key={groupIndex}>{content}</Fragment>;
        return (
          <div key={groupIndex} className="contract-signer my-4 rounded-lg border border-gray-300 p-4">
            {content}
          </div>
        );
      })}
    </div>
  );
}
