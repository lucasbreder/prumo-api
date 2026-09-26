import { User } from '../../../domain/entities/user.entity.js';
import {
  UserReader,
  UserWriter,
  MentorAdminRow,
  MentorsAdminReader,
} from '../../../domain/repositories/user.repository.js';
import { SessionRefreshRepository } from '../../../domain/repositories/session.repository.js';
import { Clock } from '../../ports/ports.js';
import {
  AccessDeniedError,
  NotFoundError,
} from '../../../../../shared/errors/domain.errors.js';
import { CreateAccountUseCase } from './create-account.usecase.js';

export function mentorParaRow(
  user: User,
  coursesCount = 0,
): MentorAdminRow {
  return {
    id: user.id,
    name: user.name,
    email: user.email.value,
    areas: user.areas,
    bio: user.bio,
    featured: user.mentorFeatured,
    status: user.mentorStatus,
    active: user.active,
    coursesCount,
  };
}

export class ListMentorsAdminUseCase {
  constructor(
    private readonly deps: {
      mentors: MentorsAdminReader;
    },
  ) {}
  async execute() {
    return { mentors: await this.deps.mentors.listAll() };
  }
}

export interface CreateMentorInput {
  name: string;
  email: string;
  password: string;
  areas?: string[];
  bio?: string;
  featured?: boolean;
}

export class CreateMentorAdminUseCase {
  constructor(
    private readonly deps: {
      createAccount: CreateAccountUseCase;
      users: UserWriter;
    },
  ) {}
  async execute(input: CreateMentorInput): Promise<MentorAdminRow> {
    // Cria a conta com papel MENTOR; o perfil entra como PENDING (default da
    // entidade) ate a aprovacao do admin (visao do mentor + vitrine publica).
    const user = await this.deps.createAccount.execute({
      name: input.name,
      email: input.email,
      password: input.password,
      role: 'MENTOR',
    });
    user.updateProfileMentor({
      areas: input.areas ?? [],
      bio: input.bio ?? '',
      featured: input.featured ?? false,
      status: 'PENDING',
    });
    await this.deps.users.save(user);
    return mentorParaRow(user);
  }
}

export interface UpdateMentorInput {
  name?: string;
  areas?: string[];
  bio?: string;
  featured?: boolean;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  active?: boolean;
}

export class UpdateMentorAdminUseCase {
  constructor(
    private readonly deps: {
      users: UserReader & UserWriter;
      mentors: MentorsAdminReader;
      sessions: SessionRefreshRepository;
      clock: Clock;
    },
  ) {}
  async execute(input: {
    mentorId: string;
    data: UpdateMentorInput;
  }): Promise<MentorAdminRow> {
    const user = await this.deps.users.byId(input.mentorId);
    if (!user) throw new NotFoundError('Mentor nao encontrado');
    if (user.role !== 'MENTOR') {
      throw new AccessDeniedError('Somente contas de mentor possuem perfil');
    }
    if (input.data.name !== undefined) user.updateProfile(input.data.name);
    user.updateProfileMentor({
      areas: input.data.areas,
      bio: input.data.bio,
      featured: input.data.featured,
      status: input.data.status,
    });
    if (input.data.active !== undefined) user.definirActive(input.data.active);
    await this.deps.users.save(user);
    if (input.data.active === false) {
      await this.deps.sessions.revokeTodasDoUser(user.id, this.deps.clock.now());
    }
    const recarregado = await this.deps.mentors
      .listAll()
      .then((rows) => rows.find((r) => r.id === user.id));
    return recarregado ?? mentorParaRow(user);
  }
}
