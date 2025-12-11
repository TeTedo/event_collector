import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateChainDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  rpcUrl: string;

  @IsNumber()
  @IsNotEmpty()
  chainId: number;
}
