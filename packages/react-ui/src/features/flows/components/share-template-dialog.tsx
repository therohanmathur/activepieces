import { useMutation } from '@tanstack/react-query';
import { t } from 'i18next';
import { useForm, SubmitHandler } from 'react-hook-form';
import { typeboxResolver } from '@hookform/resolvers/typebox';
import { Static, Type } from '@sinclair/typebox';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { INTERNAL_ERROR_TOAST, toast } from '@/components/ui/use-toast';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { templatesApi } from '@/features/templates/lib/templates-api';
import { FlowTemplate, TemplateType } from '@activepieces/shared';

const ShareTemplateSchema = Type.Object({
  description: Type.String({
    minLength: 1,
    errorMessage: t('Description is required'),
  }),
});

type ShareTemplateSchema = Static<typeof ShareTemplateSchema>;

const ShareTemplateDialog: React.FC<{
  children: React.ReactNode;
  flowId: string;
  flowVersionId: string;
}> = ({ children, flowId, flowVersionId }) => {
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const shareTemplateForm = useForm<ShareTemplateSchema>({
    resolver: typeboxResolver(ShareTemplateSchema),
  });

  const { mutate, isPending } = useMutation<
    FlowTemplate,
    Error,
    { flowId: string; description: string }
  >({
    mutationFn: async () => {
      const template = await flowsApi.getTemplate(flowId, {
        versionId: flowVersionId,
      });

      const flowTemplate = await templatesApi.create({
        template: template.template,
        type: TemplateType.PLATFORM,
        blogUrl: template.blogUrl,
        tags: template.tags,
        description: shareTemplateForm.getValues().description,
      });

      return flowTemplate;
    },
    onSuccess: () => {
      setIsShareDialogOpen(false);
      setIsSuccessDialogOpen(true);
    },
    onError: () => toast(INTERNAL_ERROR_TOAST),
  });

  const onShareTemplateSubmit: SubmitHandler<{
    description: string;
  }> = (data) => {
    mutate({
      flowId,
      description: data.description,
    });
  };

  return (
    <>
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Share Template')}</DialogTitle>
            <DialogDescription>
              {t('Generate or update a template link for the current flow to easily share it with others.')}
              <br />
              {t('The template will not have any credentials in connection fields, keeping sensitive information secure.')}
            </DialogDescription>
          </DialogHeader>
          <Form {...shareTemplateForm}>
            <form onSubmit={shareTemplateForm.handleSubmit(onShareTemplateSubmit)}>
              <FormField
                control={shareTemplateForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <Textarea
                      {...field}
                      placeholder={t('A short description of the template')}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  loading={isPending}
                  disabled={isPending}
                >
                  {t('Share Template')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Template Shared Successfully')}</DialogTitle>
            <DialogDescription>
              {t('Your template has been shared and is now visible in the Browse Templates dialog.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsSuccessDialogOpen(false)}>
              {t('Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export { ShareTemplateDialog };
