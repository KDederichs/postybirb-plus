import { Injectable, Logger } from '@nestjs/common';
import { Website } from '../website.base';
import { UsernameShortcut } from '../interfaces/username-shortcut.interface';
import { LoginResponse } from '../interfaces/login-response.interface';
import { FileRecord } from 'src/submission/file-submission/interfaces/file-record.interface';
import { ScalingOptions } from '../interfaces/scaling-options.interface';
import { FilePostData } from 'src/submission/post/interfaces/file-post-data.interface';
import {
  DefaultFileOptions,
  DefaultOptions,
} from 'src/submission/submission-part/interfaces/default-options.interface';
import { PostResponse } from 'src/submission/post/interfaces/post-response.interface';
import { PostData } from 'src/submission/post/interfaces/post-data.interface';
import { Submission } from 'src/submission/interfaces/submission.interface';
import { FileSubmission } from 'src/submission/file-submission/interfaces/file-submission.interface';
import { SubmissionPart } from 'src/submission/submission-part/interfaces/submission-part.interface';
import { ValidationParts } from 'src/submission/validator/interfaces/validation-parts.interface';
import UserAccountEntity from 'src/account/models/user-account.entity';
import FileSize from 'src/utils/filesize.util';
import Http from 'src/http/http.util';
import { PlaintextParser } from 'src/description-parsing/plaintext/plaintext.parser';
import FormContent from 'src/utils/form-content.util';
import WebsiteValidator from 'src/utils/website-validator.util';
import { FileSubmissionType } from 'src/submission/file-submission/enums/file-submission-type.enum';
import ImageManipulator from 'src/file-manipulation/manipulators/image.manipulator';
import { DerpibooruDefaultFileOptions } from './derpibooru.defaults';
import { SubmissionRating } from 'src/submission/enums/submission-rating.enum';
import BrowserWindowUtil from 'src/utils/browser-window.util';
import { DerpibooruOptions } from './derpibooru.interface';

@Injectable()
export class Derpibooru extends Website {
  private readonly logger = new Logger(Derpibooru.name);

  BASE_URL: string = 'https://derpibooru.org';
  acceptsFiles: string[] = ['jpeg', 'jpg', 'png', 'svg', 'gif', 'webm'];
  fileSubmissionOptions: object = DerpibooruDefaultFileOptions;
  acceptsSourceUrls: boolean = true;
  enableAdvertisement: boolean = false;
  defaultDescriptionParser = PlaintextParser.parse;
  usernameShortcuts: UsernameShortcut[] = [
    {
      key: 'db',
      url: 'https://derpibooru.org/profiles/$1',
    },
  ];

  async checkLoginStatus(data: UserAccountEntity): Promise<LoginResponse> {
    const status: LoginResponse = { loggedIn: false, username: null };
    const res = await Http.get<string>(`${this.BASE_URL}`, data._id);
    if (res.body.includes('Logout')) {
      status.loggedIn = true;
      status.username = res.body.match(/data-user-name="(.*?)"/)[1];
      Http.saveSessionCookies(this.BASE_URL, data._id);
    }
    return status;
  }

  getScalingOptions(file: FileRecord): ScalingOptions {
    return { maxSize: FileSize.MBtoBytes(100) };
  }

  preparseDescription(text: string) {
    return text
      .replace(/<b>/gi, '*')
      .replace(/<i>/gi, '_')
      .replace(/<u>/gi, '+')
      .replace(/<s>/gi, '-')
      .replace(/<\/b>/gi, '*')
      .replace(/<\/i>/gi, '_')
      .replace(/<\/u>/gi, '+')
      .replace(/<\/s>/gi, '-')
      .replace(/<em>/gi, '_')
      .replace(/<\/em>/gi, '_')
      .replace(/<strong>/gi, '*')
      .replace(/<\/strong>/gi, '*')
      .replace(/<a(.*?)href="(.*?)"(.*?)>(.*?)<\/a>/gi, '"$4":$2');
  }

  parseDescription(text: string) {
    return super.parseDescription(text.replace(/<a(.*?)href="(.*?)"(.*?)>(.*?)<\/a>/gi, '"$4":$2'));
  }

  async postFileSubmission(data: FilePostData<DerpibooruOptions>): Promise<PostResponse> {
    try {
      return await this.attemptFilePost(data);
    } catch (err) {
      // Users have reported it working on a second post :shrug:
      this.logger.warn(err, 'Derpibooru Post Retry');
      return await this.attemptFilePost(data);
    }
  }

  private getRating(rating: SubmissionRating) {
    switch (rating) {
      case SubmissionRating.MATURE:
        return 'questionable';
      case SubmissionRating.ADULT:
      case SubmissionRating.EXTREME:
        return 'explicit';
      case SubmissionRating.GENERAL:
      default:
        return 'safe';
    }
  }

  private async attemptFilePost(data: FilePostData<DerpibooruOptions>): Promise<PostResponse> {
    const tags: string[] = this.parseTags(data.tags, {
      spaceReplacer: ' ',
      minLength: 1,
      maxLength: 100,
    });
    const ratingTag: string = this.getRating(data.rating);
    if (!tags.includes(ratingTag)) tags.push(ratingTag);

    const form: any = {
      ...(await BrowserWindowUtil.getFormData(
        data.part.accountId,
        `${this.BASE_URL}/images/new`,
        'document.body.querySelectorAll("form")[3]',
      )),
      _method: 'post',
      'image[tag_input]': tags.join(', ').trim(),
      'image[image]': data.primary.file,
      'image[description]': data.description,
      'image[source_url]': data.options.source || data.sources[0] || '',
    };

    const postResponse = await Http.post<string>(`${this.BASE_URL}/images`, data.part.accountId, {
      type: 'multipart',
      data: form,
    });

    this.verifyResponse(postResponse);
    return this.createPostResponse({});
  }

  postNotificationSubmission(data: PostData<Submission, any>): Promise<PostResponse> {
    throw new Error('Method not implemented.');
  }

  validateFileSubmission(
    submission: FileSubmission,
    submissionPart: SubmissionPart<any>,
    defaultPart: SubmissionPart<DefaultOptions>,
  ): ValidationParts {
    const problems: string[] = [];
    const warnings: string[] = [];
    const isAutoscaling: boolean = submissionPart.data.autoScale;

    if (FormContent.getTags(defaultPart.data.tags, submissionPart.data.tags).length < 3) {
      problems.push('Requires at least 3 tags.');
    }

    if (!WebsiteValidator.supportsFileType(submission.primary, this.acceptsFiles)) {
      problems.push(
        `Does not support file format: (${submission.primary.name}) ${submission.primary.mimetype}.`,
      );
    }

    const { type, size, name } = submission.primary;
    let maxMB: number = 100;

    if (FileSize.MBtoBytes(maxMB) < size) {
      if (
        isAutoscaling &&
        type === FileSubmissionType.IMAGE &&
        ImageManipulator.isMimeType(submission.primary.mimetype)
      ) {
        warnings.push(`${name} will be scaled down to ${maxMB}MB`);
      } else {
        problems.push(`Derpibooru limits ${submission.primary.mimetype} to ${maxMB}MB`);
      }
    }

    return { problems, warnings };
  }
}
