// apps/backend/src/support/dto/tickets.dto.ts
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const TICKET_CATEGORIES = ['transaction', 'kyc', 'account', 'technical', 'other'] as const;
export const TICKET_SPACES = ['client', 'merchant'] as const;
export const DISPUTE_OUTCOMES = ['ACCEPTED', 'REJECTED', 'INFO'] as const;

export class CreateTicketDto {
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Le sujet est trop court.' })
  @MaxLength(120)
  subject!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'Décrivez votre demande (10 caractères minimum).' })
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsIn(TICKET_CATEGORIES as unknown as string[])
  category?: (typeof TICKET_CATEGORIES)[number];

  /** Compte depuis lequel la demande est ouverte (défaut : client). Un litige sur une opération du commerce passe toujours en « merchant ». */
  @IsOptional()
  @IsIn(TICKET_SPACES as unknown as string[])
  space?: (typeof TICKET_SPACES)[number];

  /** Opération contestée : le ticket devient un litige. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  transactionId?: string;
}

export class TicketReplyDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  /** Note interne : invisible pour le client (support uniquement). */
  @IsOptional()
  internal?: boolean;
}

export class ResolveTicketDto {
  @IsIn(DISPUTE_OUTCOMES as unknown as string[])
  outcome!: (typeof DISPUTE_OUTCOMES)[number];

  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Expliquez la décision au client (5 caractères minimum).' })
  @MaxLength(1000)
  note!: string;
}
