import { Navigate, useLocation } from 'react-router-dom';

import { useAuthorization } from '@/hooks/authorization-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { determineDefaultRoute } from '@/lib/utils';
import { projectHooks } from '@/hooks/project-hooks';

export const DefaultRoute = () => {
  const token = authenticationSession.getToken();
  const { checkAccess } = useAuthorization();
  const location = useLocation();
  const { data: currentProject } = projectHooks.useCurrentProject();

  if (!token) {
    const searchParams = new URLSearchParams();
    searchParams.set('from', location.pathname + location.search);
    return (
      <Navigate
        to={`/sign-in?${searchParams.toString()}`}
        replace={true}
      ></Navigate>
    );
  }

  // If we have a current project, redirect to its dashboard => This is causing issue & giving a blank screen on consequent loading
  // if (currentProject) {
  //   return <Navigate to={`/projects/${currentProject.id}`} replace />;
  // }

  // Otherwise use the default route based on permissions
  return <Navigate to={determineDefaultRoute(checkAccess)} replace />;
};
