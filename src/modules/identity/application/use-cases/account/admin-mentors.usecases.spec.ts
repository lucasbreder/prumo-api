import { describe, expect, it } from 'vitest';
import {
  FakeHasher,
  FakeClock,
  FakePublisher,
  FakeSessionRepo,
  FakeUserRepo,
} from '../../fakes/in-memory.fakes.js';
import { CreateAccountUseCase } from './create-account.usecase.js';
import {
  CreateMentorAdminUseCase,
  ListMentorsAdminUseCase,
  UpdateMentorAdminUseCase,
} from './admin-mentors.usecases.js';
import { SessionRefresh } from '../../../domain/entities/refresh-session.entity.js';
import type {
  MentorAdminRow,
  MentorsAdminReader,
} from '../../../domain/repositories/user.repository.js';

function fakeMentors(users: FakeUserRepo): MentorsAdminReader {
  return {
    async listAll(): Promise<MentorAdminRow[]> {
      return [...users.users.values()]
        .filter((u) => u.role === 'MENTOR')
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email.value,
          areas: u.areas,
          bio: u.bio,
          featured: u.mentorFeatured,
          status: u.mentorStatus,
          active: u.active,
          coursesCount: 0,
        }));
    },
  };
}

function build() {
  const users = new FakeUserRepo();
  const hasher = new FakeHasher();
  const events = new FakePublisher();
  const sessions = new FakeSessionRepo();
  const clock = new FakeClock();
  const createAccount = new CreateAccountUseCase({ users, hasher, events });
  const mentors = fakeMentors(users);
  return {
    users,
    sessions,
    create: new CreateMentorAdminUseCase({ createAccount, users }),
    update: new UpdateMentorAdminUseCase({ users, mentors, sessions, clock }),
    list: new ListMentorsAdminUseCase({ mentors }),
    mentors,
  };
}

describe('Admin — cadastro de mentores', () => {
  it('cadastra mentor com papel MENTOR e entra como pendente', async () => {
    const { create, users } = build();
    const mentor = await create.execute({
      name: 'Marina Sole',
      email: 'marina@prumo.dev',
      password: 'senha12345',
      areas: ['Gestão', 'Vendas'],
      bio: 'Mentora de estúdio.',
    });
    expect(mentor.status).toBe('PENDING');
    expect(mentor.featured).toBe(false);
    expect(mentor.areas).toEqual(['Gestão', 'Vendas']);
    const guardado = await users.byId(mentor.id);
    expect(guardado?.role).toBe('MENTOR');
    expect(guardado?.mentorStatus).toBe('PENDING');
  });

  it('recusa e-mail duplicado no cadastro', async () => {
    const { create } = build();
    await create.execute({
      name: 'A',
      email: 'dup@prumo.dev',
      password: 'senha12345',
    });
    await expect(
      create.execute({
        name: 'B',
        email: 'dup@prumo.dev',
        password: 'senha12345',
      }),
    ).rejects.toThrow(/e-mail/);
  });

  it('aprova mentor pendente e destaca na pagina', async () => {
    const { create, update, list } = build();
    const mentor = await create.execute({
      name: 'Marina',
      email: 'marina@prumo.dev',
      password: 'senha12345',
    });
    await update.execute({
      mentorId: mentor.id,
      data: { status: 'APPROVED', featured: true },
    });
    const { mentors: rows } = await list.execute();
    const alvo = rows.find((r) => r.id === mentor.id);
    expect(alvo?.status).toBe('APPROVED');
    expect(alvo?.featured).toBe(true);
  });

  it('desativar mentor derruba as sessoes ativas', async () => {
    const { create, update, sessions } = build();
    const mentor = await create.execute({
      name: 'Marina',
      email: 'marina@prumo.dev',
      password: 'senha12345',
    });
    sessions.sessions.push(
      SessionRefresh.issue({
        id: 's1',
        userId: mentor.id,
        tokenHash: 'h1',
        familyId: 'f1',
        expiresAt: new Date(Date.now() + 9999999),
      }),
    );
    await update.execute({ mentorId: mentor.id, data: { active: false } });
    expect(sessions.sessions[0].jaRevogada).toBe(true);
  });

  it('recusa editar conta que nao e mentor', async () => {
    const { users, update } = build();
    const student = await new CreateAccountUseCase({
      users,
      hasher: new FakeHasher(),
      events: new FakePublisher(),
    }).execute({
      name: 'Aluno',
      email: 'aluno@prumo.dev',
      password: 'senha12345',
      role: 'STUDENT',
    });
    await expect(
      update.execute({ mentorId: student.id, data: { featured: true } }),
    ).rejects.toThrow(/mentor/);
  });
});
