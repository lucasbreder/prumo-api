import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Public } from '../../../shared/auth/decorators/public.decorator.js';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../../shared/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../../shared/auth/auth-user.types.js';
import {
  SubscribeNewsletterUseCase,
  PreviewHeroImagesUseCase,
  PresignHeroUploadUseCase,
  ListTestimonialsUseCase,
  ListMenusUseCase,
  ListPublicMentorsUseCase,
  GetHighlightsUseCase,
  GetMethodUseCase,
  RegisterTestimonialUseCase,
  RemoveMenuItemUseCase,
  SaveHighlightsUseCase,
  SaveTestimonialStatusUseCase,
  SaveMenuItemUseCase,
  SaveMethodUseCase,
} from '../application/use-cases/site.usecases.js';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GetAccountUseCase } from '../../identity/application/use-cases/account/account.usecases.js';
class NewsletterInput {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;
}
class MenuInput {
  @IsOptional()
  @IsString()
  id?: string;
  @IsIn(['HEADER', 'FOOTER'])
  location!: 'HEADER' | 'FOOTER';
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order!: number;
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  url!: string;
  @IsIn(['PAGE', 'CTA', 'LINK'])
  type!: 'PAGE' | 'CTA' | 'LINK';
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(60)
  column?: string | null;
}
class MethodStepInput {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order!: number;
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}
class MethodInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  kicker!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
  @Type(() => Boolean)
  @IsBoolean()
  published!: boolean;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MethodStepInput)
  steps!: MethodStepInput[];
}
class TestimonialInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
}
class TestimonialStatusInput {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED'])
  status?: 'PENDING' | 'APPROVED';
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  visible?: boolean;
}
class HighlightStatInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  value!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label!: string;
}
class HeroInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  headline!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  highlightWord?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  images?: string[];

  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => HighlightStatInput)
  stats!: HighlightStatInput[];
}
class HighlightMentorInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  area!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  slots!: number;
}
class HighlightCtaInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Matches(/^\/|^https?:\/\//, {
    message: 'url deve comecar com / ou http',
  })
  url!: string;
}
class ManifestoItemInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  number!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text!: string;
}
class AdviceItemInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  number!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}
class PrumoSectionInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  eyebrow!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  lead!: string;
}
class CoursesSectionInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  eyebrow!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  linkLabel!: string;
}
class AdviceSectionInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  eyebrow!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  note!: string;
}
class MethodSectionInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  eyebrow!: string;
}
class TestimonialsSectionInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  eyebrow!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;
}
class PlansSectionInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  eyebrow!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  description!: string;

  @IsOptional()
  @IsBoolean()
  visible = true;
}
class NewsletterSectionInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  eyebrow!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  description!: string;
}
class HomeSectionsInput {
  @ValidateNested()
  @Type(() => PrumoSectionInput)
  prumo!: PrumoSectionInput;

  @ValidateNested()
  @Type(() => CoursesSectionInput)
  courses!: CoursesSectionInput;

  @ValidateNested()
  @Type(() => AdviceSectionInput)
  advice!: AdviceSectionInput;

  @ValidateNested()
  @Type(() => MethodSectionInput)
  method!: MethodSectionInput;

  @ValidateNested()
  @Type(() => TestimonialsSectionInput)
  testimonials!: TestimonialsSectionInput;

  @ValidateNested()
  @Type(() => PlansSectionInput)
  plans!: PlansSectionInput;

  @ValidateNested()
  @Type(() => NewsletterSectionInput)
  newsletter!: NewsletterSectionInput;
}
class HomeHighlightsInput {
  @ValidateNested()
  @Type(() => HeroInput)
  hero!: HeroInput;

  @ValidateNested()
  @Type(() => HighlightMentorInput)
  mentor!: HighlightMentorInput;

  @ValidateNested()
  @Type(() => HighlightCtaInput)
  cta!: HighlightCtaInput;

  @IsOptional()
  @ValidateNested()
  @Type(() => HomeSectionsInput)
  sections?: HomeSectionsInput;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ManifestoItemInput)
  manifesto?: ManifestoItemInput[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => AdviceItemInput)
  adviceItems?: AdviceItemInput[];
}
class HeroImageInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameArquivo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
@Controller('site')
@Public()
export class SitePublicController {
  constructor(
    private readonly listMenus: ListMenusUseCase,
    private readonly getMethod: GetMethodUseCase,
    private readonly listMentors: ListPublicMentorsUseCase,
    private readonly highlights: GetHighlightsUseCase,
  ) {}
  @Get('menus')
  async menu(
    @Query('location')
    location?: 'HEADER' | 'FOOTER',
  ) {
    return this.listMenus.execute({ location, onlyActive: true });
  }
  @Get('method')
  async methodPublic() {
    return { method: await this.getMethod.execute() };
  }
  @Get('mentors')
  async publicMentors() {
    return this.listMentors.execute();
  }
  @Get('highlights')
  async homeHighlights() {
    return { highlights: await this.highlights.execute({ signedImages: true }) };
  }
}
@Controller('testimonials')
export class TestimonialsController {
  constructor(
    private readonly listTestimonials: ListTestimonialsUseCase,
    private readonly register: RegisterTestimonialUseCase,
    private readonly getAccount: GetAccountUseCase,
  ) {}
  @Get()
  @Public()
  async publicList() {
    return this.listTestimonials.execute({ public: true });
  }
  @Post()
  async create(
    @CurrentUser()
    user: AuthUser,
    @Body()
    input: TestimonialInput,
  ) {
    const account = await this.getAccount.execute({ userId: user.id });
    return this.register.execute({
      studentId: user.role === 'STUDENT' ? user.id : null,
      authorName: account.name,
      text: input.text,
      rating: input.rating,
      roleAuthor: user.role,
    });
  }
}
@Controller('newsletter')
@Public()
export class NewsletterController {
  constructor(private readonly subscribe: SubscribeNewsletterUseCase) {}
  @Post()
  @HttpCode(201)
  async create(
    @Body()
    input: NewsletterInput,
  ) {
    return this.subscribe.execute(input);
  }
}
@Controller('admin/site')
@Roles('ADMIN')
export class AdminSiteController {
  constructor(
    private readonly saveMenu: SaveMenuItemUseCase,
    private readonly listMenus: ListMenusUseCase,
    private readonly removeMenu: RemoveMenuItemUseCase,
    private readonly saveMethod: SaveMethodUseCase,
    private readonly getMethod: GetMethodUseCase,
    private readonly saveHighlights: SaveHighlightsUseCase,
    private readonly getHighlights: GetHighlightsUseCase,
    private readonly previewImages: PreviewHeroImagesUseCase,
    private readonly presignImage: PresignHeroUploadUseCase,
  ) {}
  @Get('highlights')
  async highlightsList() {
    const highlights = await this.getHighlights.execute();
    const chaves =
      'hero' in highlights ? highlights.hero.images : [];
    return {
      highlights,
      previews: await this.previewImages.execute(chaves),
    };
  }
  @Post('hero-images')
  @HttpCode(201)
  async presignHeroImage(
    @Body()
    input: HeroImageInput,
  ) {
    return this.presignImage.execute({
      nomeArquivo: input.nameArquivo,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });
  }
  @Put('highlights')
  async saveHomeHighlights(
    @Body()
    input: HomeHighlightsInput,
  ) {
    return this.saveHighlights.execute({
      ...input,
      hero: {
        ...input.hero,
        highlightWord: input.hero.highlightWord ?? null,
        images: input.hero.images ?? [],
      },
    });
  }
  @Get('menus')
  async menusList(
    @Query('location')
    location?: 'HEADER' | 'FOOTER',
  ) {
    return this.listMenus.execute({ location, onlyActive: false });
  }
  @Post('menus')
  async menuCreate(
    @Body()
    input: MenuInput,
  ) {
    return this.saveMenu.execute(input);
  }
  @Patch('menus/:id')
  async menuUpdate(
    @Param('id')
    id: string,
    @Body()
    input: MenuInput,
  ) {
    return this.saveMenu.execute({ ...input, id });
  }
  @Delete('menus/:id')
  @HttpCode(204)
  async menuRemove(
    @Param('id')
    id: string,
  ): Promise<void> {
    await this.removeMenu.execute(id);
  }
  @Get('method')
  async methodGet() {
    return { method: await this.getMethod.execute() };
  }
  @Put('method')
  async methodSave(
    @Body()
    input: MethodInput,
  ) {
    return this.saveMethod.execute(input);
  }
}
@Controller('admin/testimonials')
@Roles('ADMIN')
export class AdminTestimonialsController {
  constructor(
    private readonly listTestimonials: ListTestimonialsUseCase,
    private readonly changeStatus: SaveTestimonialStatusUseCase,
  ) {}
  @Get()
  async list(
    @Query('status')
    status?: 'PENDING' | 'APPROVED',
  ) {
    return this.listTestimonials.execute({ public: false, status });
  }
  @Patch(':id')
  async update(
    @Param('id')
    id: string,
    @Body()
    input: TestimonialStatusInput,
  ) {
    return this.changeStatus.execute({ id, ...input });
  }
}
