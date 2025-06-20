import { t } from 'i18next';
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import GoogleIcon from '../../../assets/img/custom/auth/google-icon.svg';
import { authenticationSession } from '@/lib/authentication-session';
import { useRedirectAfterLogin } from '@/lib/navigation-utils';
import {
  ApFlagId,
  ThirdPartyAuthnProvidersToShowMap,
} from '@activepieces/shared';

import { HorizontalSeparatorWithText } from '../../../components/ui/separator';
import { flagsHooks } from '../../../hooks/flags-hooks';

import { SignInForm } from './sign-in-form';
import { SignUpForm } from './sign-up-form';

const BottomNote = ({ isSignup }: { isSignup: boolean }) => {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.toString();

  return isSignup ? (
    <div className="mb-4 text-center text-sm">
      {t('Already have an account?')}
      <Link
        to={`/sign-in?${searchQuery}`}
        className="pl-1 text-muted-foreground hover:text-primary text-sm transition-all duration-200"
      >
        {t('Sign in')}
      </Link>
    </div>
  ) : (
    <div className="mb-4 text-center text-sm">
      {t("Don't have an account?")}
      <Link
        to={`/sign-up?${searchQuery}`}
        className="pl-1 text-muted-foreground hover:text-primary text-sm transition-all duration-200"
      >
        {t('Sign up')}
      </Link>
    </div>
  );
};

const AuthSeparator = ({
  isEmailAuthEnabled,
}: {
  isEmailAuthEnabled: boolean;
}) => {
  return isEmailAuthEnabled ? (
    <HorizontalSeparatorWithText className="my-4">
      {t('OR')}
    </HorizontalSeparatorWithText>
  ) : null;
};

const AuthFormTemplate = React.memo(
  ({ form }: { form: 'signin' | 'signup' }) => {
    const isSignUp = form === 'signup';
    const token = authenticationSession.getToken();
    const redirectAfterLogin = useRedirectAfterLogin();
    const [showCheckYourEmailNote, setShowCheckYourEmailNote] = useState(false);
    const { data: isEmailAuthEnabled } = flagsHooks.useFlag<boolean>(
      ApFlagId.EMAIL_AUTH_ENABLED,
    );
    const data = {
      signin: {
        title: t('Welcome Back!'),
        description: t('Enter your email below to sign in to your account'),
        showNameFields: false,
      },
      signup: {
        title: t("Let's Get Started!"),
        description: t('Create your account and start flowing!'),
        showNameFields: true,
      },
    }[form];

    const handleGoogleLogin = () => {
      window.location.href = '/api/v1/authentication/google/login';
    };

    if (token) {
      redirectAfterLogin();
    }

    return (
      <Card className="w-[28rem] rounded-sm drop-shadow-xl">
        {!showCheckYourEmailNote && (
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{data.title}</CardTitle>
            <CardDescription>{data.description}</CardDescription>
          </CardHeader>
        )}

        <CardContent>
          {!showCheckYourEmailNote && (
            <div className="flex flex-col gap-4">
              <Button
                variant="outline"
                className="w-full rounded-sm"
                onClick={handleGoogleLogin}
              >
                <img src={GoogleIcon} alt="Google icon" className="mr-2 h-4 w-4" />
                {isSignUp
                  ? t('Sign up with Google')
                  : t('Sign in with Google')}
              </Button>
            </div>
          )}
          <AuthSeparator
            isEmailAuthEnabled={
              (isEmailAuthEnabled ?? true) && !showCheckYourEmailNote
            }
          ></AuthSeparator>
          {isEmailAuthEnabled ? (
            isSignUp ? (
              <SignUpForm
                setShowCheckYourEmailNote={setShowCheckYourEmailNote}
                showCheckYourEmailNote={showCheckYourEmailNote}
              />
            ) : (
              <SignInForm />
            )
          ) : null}
        </CardContent>

        <BottomNote isSignup={isSignUp}></BottomNote>
      </Card>
    );
  },
);

AuthFormTemplate.displayName = 'AuthFormTemplate';

export { AuthFormTemplate };
