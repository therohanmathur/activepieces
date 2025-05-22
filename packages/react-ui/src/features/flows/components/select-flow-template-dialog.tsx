import { DialogDescription } from '@radix-ui/react-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { t } from 'i18next';
import { ArrowLeft, Info, Search, SearchX } from 'lucide-react';
import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApMarkdown } from '@/components/custom/markdown';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { InputWithIcon } from '@/components/ui/Input-with-icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/ui/spinner';
import {
  TooltipContent,
  TooltipTrigger,
  Tooltip,
} from '@/components/ui/tooltip';
import { INTERNAL_ERROR_TOAST, toast } from '@/components/ui/use-toast';
import { PieceIconList } from '@/features/pieces/components/piece-icon-list';
import { templatesApi } from '@/features/templates/lib/templates-api';
import { authenticationSession } from '@/lib/authentication-session';
import {
  MarkdownVariant,
  FlowOperationType,
  FlowTemplate,
  PopulatedFlow,
  TemplateType,
} from '@activepieces/shared';

import { flowsApi } from '../lib/flows-api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type TemplateCardProps = {
  template: FlowTemplate;
  onSelectTemplate: (template: FlowTemplate) => void;
};

const TemplateCard = ({ template, onSelectTemplate }: TemplateCardProps) => {
  const selectTemplate = (template: FlowTemplate) => {
    onSelectTemplate(template);
  };

  const navigate = useNavigate();

  const { mutate: createFlow, isPending } = useMutation<
    PopulatedFlow,
    Error,
    FlowTemplate
  >({
    mutationFn: async (template: FlowTemplate) => {
      const newFlow = await flowsApi.create({
        displayName: template.name,
        projectId: authenticationSession.getProjectId()!,
      });
      return await flowsApi.update(newFlow.id, {
        type: FlowOperationType.IMPORT_FLOW,
        request: {
          displayName: template.name,
          trigger: template.template.trigger,
          schemaVersion: template.template.schemaVersion,
        },
      });
    },
    onSuccess: (flow) => {
      navigate(`/flows/${flow.id}`);
    },
    onError: () => {
      toast(INTERNAL_ERROR_TOAST);
    },
  });

  return (
    <div
      key={template.id}
      className="rounded-lg border border-solid border-dividers overflow-hidden"
    >
      <div className="flex items-center gap-2 p-4 ">
        <PieceIconList
          trigger={template.template.trigger}
          maxNumberOfIconsToShow={2}
        />
      </div>
      <div className="text-sm font-medium px-4 min-h-16">{template.name}</div>
      {template.description && (
        <div className="text-sm text-muted-foreground px-4 mb-4">
          {template.description}
        </div>
      )}
      <div className="py-2 px-4 gap-1 flex items-center">
        <Button
          variant="default"
          loading={isPending}
          className="px-2 h-8"
          onClick={() => createFlow(template)}
        >
          {t('Use Template')}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="size-10 flex justify-center items-center">
              <Button
                variant="ghost"
                className="rounded-full p-3 hover:bg-muted cursor-pointer flex justify-center items-center"
                onClick={() => selectTemplate(template)}
              >
                <Info className="w-4 h-4" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span className="text-sm">{t('Learn more')}</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

const SelectFlowTemplateDialog = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carousel = useRef<CarouselApi>();

  useEffect(() => {
    if (carousel.current) {
      carousel.current.scrollTo(carouselIndex);
    }
  }, [carouselIndex]);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.list({ type: TemplateType.PLATFORM }),
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const unselectTemplate = () => {
    setSelectedTemplate(null);
    setCarouselIndex(0);
  };

  const filteredTemplates = templates?.data.filter((template) =>
    template.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Dialog onOpenChange={unselectTemplate}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="lg:min-w-[850px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex min-h-9 flex-row items-center justify-start gap-2 items-center h-full">
            {selectedTemplate && (
              <Button variant="ghost" size="sm" onClick={() => {
                if (carousel.current) {
                  carousel.current.scrollTo(0);
                }
                setTimeout(() => {
                  setSelectedTemplate(null);
                }, 50);
              }}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {t('Browse Templates')}
          </DialogTitle>
        </DialogHeader>
        <Carousel setApi={(api) => (carousel.current = api)}>
          <CarouselContent className="min-h-[300px] h-[70vh] max-h-[820px]">
            <CarouselItem key="templates">
              <div>
                <div className="p-1">
                  <InputWithIcon
                    icon={<Search className="w-4 h-4" />}
                    type="text"
                    value={search}
                    onChange={handleSearchChange}
                    placeholder={t('Search templates')}
                    className="mb-4"
                  />
                </div>
                {filteredTemplates?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px]">
                    <SearchX className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {t('No templates found, try adjusting your search')}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(70vh-100px)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                      {filteredTemplates?.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          onSelectTemplate={(clickedTemplate) => {
                            setSelectedTemplate(clickedTemplate);
                            if (carousel.current) {
                              const currentIndex = carousel.current.selectedScrollSnap();
                              if (currentIndex === 1) {
                                carousel.current.scrollTo(0, true);
                                setTimeout(() => {
                                  carousel.current?.scrollTo(1);
                                }, 50);
                              } else {
                                carousel.current.scrollTo(1);
                              }
                            }
                          }}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </CarouselItem>
            <CarouselItem key="template-details">
              {selectedTemplate ? (
                <div className="flex justify-center items-start h-[70vh] max-h-[820px] w-full">
                  <Card className="w-full max-w-2xl shadow-xl border-none">
                    {/* Header with icons */}
                    <div className="rounded-t-lg bg-green-200 flex flex-col items-center justify-center py-6 relative">
                      <div className="flex flex-row items-center justify-center gap-6">
                        <PieceIconList
                          trigger={selectedTemplate.template.trigger}
                          maxNumberOfIconsToShow={3}
                        />
                      </div>
                      {/* List all pieces below the icons */}
                      {/* { selectedTemplate.pieces.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                          {selectedTemplate.pieces.map((piece, idx) => (
                            <Badge key={piece + idx} className="bg-green-500 text-white font-medium text-sm px-3 py-1 rounded-full">
                              {piece}
                            </Badge>
                          ))}
                        </div>
                      )} */}
                    </div>
                    <CardHeader className="pb-2 pt-6 flex flex-col items-start">
                      <CardTitle className="text-2xl font-bold mb-1">
                        {selectedTemplate.name}
                      </CardTitle>
                      {selectedTemplate.description && (
                        <CardDescription className="text-base mt-2">
                          {selectedTemplate.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <Separator className="my-2" />
                    <CardContent className="flex flex-col gap-4">
                      {/* Blog link if available */}
                      {selectedTemplate.blogUrl && (
                        <div className="text-sm text-muted-foreground mb-2">
                          {t('Read more about this template in')}{' '}
                          <a
                            href={selectedTemplate.blogUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {t('this blog!')}
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </CarouselItem>
          </CarouselContent>
        </Carousel>
      </DialogContent>
    </Dialog>
  );
};

export { SelectFlowTemplateDialog };
