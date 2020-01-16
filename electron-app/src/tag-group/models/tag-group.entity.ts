import { TagGroup } from '../interfaces/tag-group.interface';
import { IsArray, IsString, IsNotEmpty } from 'class-validator';
import Entity from '../../base/entity/entity.base';

export default class TagGroupEntity extends Entity implements TagGroup {
  @IsString()
  @IsNotEmpty()
  alias: string;

  @IsArray()
  tags: string[];
}