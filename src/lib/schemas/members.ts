import { z } from 'zod';

export const ListMembersQuerySchema = z.object({}).strict();

export const AddMemberBodySchema = z
  .object({
    email: z.string().email('Format email tidak valid.').trim().toLowerCase(),
    role: z.enum(['admin', 'maker', 'approver', 'viewer'], {
      message: 'Peran harus salah satu dari: admin, maker, approver, viewer',
    }),
  })
  .strict();

export const UpdateMemberBodySchema = z
  .object({
    userId: z.string().uuid('ID pengguna tidak valid.'),
    role: z.enum(['admin', 'maker', 'approver', 'viewer'], {
      message: 'Peran harus salah satu dari: admin, maker, approver, viewer',
    }),
  })
  .strict();

export const DeleteMemberBodySchema = z
  .object({
    userId: z.string().uuid('ID pengguna tidak valid.'),
  })
  .strict();
